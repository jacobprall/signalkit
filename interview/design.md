# SignalKit: Design Decisions

## 1. Data Collection

### YC Directory Source

Source: `https://yc-oss.github.io/api/companies/all.json` (community-maintained, updated daily, 5,690 companies)

Filter on ingest: `team_size >= 1 && team_size <= 50 && status === 'Active'`

Key fields mapped to our `companies` table:

| YC Field | Our Field | Notes |
|----------|-----------|-------|
| `id` | `source_id` | |
| `name` | `name` | |
| `slug` | `slug` | |
| `website` | `domain`, `website_url` | Parse domain from URL |
| `team_size` | stored in `source_data` | |
| `one_liner` | stored in `source_data` | |
| `long_description` | stored in `source_data` | |
| `industry` | stored in `source_data` | |
| `industries` | stored in `source_data` | |
| `tags` | stored in `source_data` | |
| `batch` | stored in `source_data` | |
| `stage` | stored in `source_data` | |
| `isHiring` | stored in `source_data` | Also produces a signal |
| `url` | stored in `source_data` | YC profile page URL |
| Full record | `source_data` | Raw JSON preserved |

The YC collector runs once on initial load, then only when the user clicks **Sync** in the dashboard. No automatic re-fetching schedule.

### URL-Based Scraping Architecture

Scrapers are keyed by **URL**. Each URL is a unit of work. Different scraper types handle different page categories, but they share the same storage and change-detection model.

```
pages
  id              uuid PK
  company_id      uuid FK → companies
  url             text UNIQUE
  page_type       text          -- 'homepage', 'careers', 'login', 'docs'
  content_text    text          -- stripped, extracted text (no HTML)
  content_hash    text          -- sha256 of content_text
  scraped_at      timestamptz
  created_at      timestamptz
```

**Page discovery flow:**
1. YC collector upserts companies with `website_url`
2. For each company, enqueue a `scrape:homepage` job with their `website_url`
3. Homepage scraper runs headless browser, extracts text, and **discovers links** to careers and login/signup pages
4. For each discovered link, enqueue a `scrape:careers` or `scrape:login` job
5. Each scraper writes to the `pages` table

**Link discovery heuristics** (from homepage):
- Careers/jobs: match href or link text against `/careers`, `/jobs`, `jobs.`, `careers.`, link text containing "careers", "jobs", "we're hiring"
- Login/signup/product: match against `/login`, `/signin`, `/signup`, `/app`, `/dashboard`, link text containing "log in", "sign in", "sign up", "get started", "try", "start free"

**Change detection:**
- Compute `sha256(content_text)` after extraction
- Before writing, compare against stored `content_hash`
- If identical, skip — don't update `scraped_at`, don't enqueue downstream jobs
- If changed (or new), write the new content and enqueue detection jobs

**No automatic re-scraping.** Users trigger a sync manually via the dashboard. This avoids unnecessary crawling and keeps the system simple. A sync re-runs the full pipeline for a company (or all companies): scrape → detect → evaluate triggers.

### Headless Browser

Use Playwright for page rendering. Many YC startup sites are SPAs (Next.js, React). A simple HTTP fetch won't get usable content.

Extraction pipeline per page:
1. Navigate to URL with Playwright
2. Wait for network idle
3. Extract `document.body.innerText` (stripped text, no HTML)
4. Extract all `<a>` hrefs for link discovery (homepage only)
5. Close page

Resource budget: headless browser is memory-intensive. Process scrape jobs with bounded concurrency on the worker (e.g., 3 concurrent browser pages max via BullMQ concurrency setting).

### DNS/HTTP Hosting Detector

Unchanged from spec. Two-step detection per company domain:

1. **DNS CNAME lookup** — `dns.resolveCname(domain)` and `dns.resolveCname('www.' + domain)`
2. **HTTP header check** — `HEAD` request, inspect `Via`, `Server`, `X-Powered-By` headers

Detection signatures:

| Provider | DNS Pattern | Header Pattern |
|----------|-------------|----------------|
| Heroku | `*.herokuapp.com`, `*.herokussl.com` | `Via: 1.1 vegur` |
| AWS App Runner | `*.awsapprunner.com` | |
| Render | `*.onrender.com` | `Server: Render` |
| Railway | `*.railway.app` | |
| Fly.io | `*.fly.dev` | |
| Vercel | `*.vercel-dns.com`, `cname.vercel-dns.com` | `Server: Vercel`, `X-Vercel-Id` |
| Netlify | `*.netlify.app` | `Server: Netlify` |

Produces a `hosting_detected` signal. No headless browser needed — pure Node.js DNS + HTTP.

---

## 2. Signals

### Upsert Model

Signals represent **current state**, not a time series. Each company has at most one signal per `signal_type`. Re-detection overwrites the existing signal.

**Unique constraint:** `(company_id, signal_type)`

```sql
INSERT INTO signals (id, company_id, signal_type, source, value, confidence, detected_at)
VALUES (...)
ON CONFLICT (company_id, signal_type)
DO UPDATE SET
  value = EXCLUDED.value,
  previous_value = signals.value,
  confidence = EXCLUDED.confidence,
  detected_at = EXCLUDED.detected_at;
```

This makes the system inherently idempotent: running the same detection twice with the same data produces the same state. The `previous_value` field captures what changed for change-alert actions.

### Signal Types (v1)

| Signal Type | Source | Value Shape |
|------------|--------|-------------|
| `hosting_detected` | dns-detector | `{ provider, method, raw_cname?, raw_header? }` |
| `hiring_status` | yc-directory | `{ isHiring: boolean }` |
| `careers_page` | website-analysis (AI) | `{ roles: [{ title, seniority, department }], has_devops: boolean, has_infra: boolean, mentions_heroku: boolean }` |
| `product_profile` | website-analysis (AI) | `{ description, category, likely_stack: string[], complexity: 'simple'|'moderate'|'complex' }` |
| `tech_stack` | website-analysis (AI) | `{ detected: string[], source: 'careers'|'homepage'|'login' }` |

### Signal Evaluation

After any signal upsert, the worker enqueues an `evaluate_triggers` job for that company. Trigger evaluation is described in section 4.

---

## 3. AI Integration

### Website Analysis Detector

The `website_analysis` detector is AI-powered but conforms to the same `Detector` interface. It takes crawled page content and extracts structured signals.

**Input preparation:**
- Strip all HTML before sending (we already store `content_text` only)
- For careers pages: send only the careers page text
- For homepage/login: send only those pages
- Don't bundle all pages into one call — separate calls per signal type to keep prompts focused and token usage efficient

**Two AI detection calls per company:**

1. **Careers analysis** (if careers page exists):
   - Input: careers page `content_text`
   - Prompt: extract job roles, identify DevOps/infra/platform roles, detect mentions of specific hosting providers
   - Output: `careers_page` signal

2. **Product analysis** (from homepage + login page):
   - Input: homepage `content_text` + login page `content_text` (if found)
   - Prompt: describe the product, infer likely tech stack, assess infrastructure complexity
   - Output: `product_profile` signal + `tech_stack` signal

**Structured output:** Use Anthropic's tool use / JSON mode to get typed responses. Define Zod schemas for each output shape, validate before writing signals.

**Token budget:**
- Most startup landing pages are 500-2,000 words stripped → well within context limits
- Careers pages vary more widely. If >4,000 words, truncate to first 4,000 (most role listings are at the top)

**Error handling:**
- If LLM returns invalid JSON or fails validation, mark the detection job as failed, don't write signals
- Retry once with a simplified prompt, then skip
- Log the failure for observability

---

## 4. Triggers

### Condition Model

Simple field matching against signals. Conditions are an array of signal matchers joined by AND (all must match). Each matcher tests for the existence of a signal type and optionally matches against fields within `value`.

```typescript
interface TriggerCondition {
  signal_type: string
  field?: string        // JSON path within value, e.g. 'provider' or 'has_devops'
  operator: 'eq' | 'neq' | 'exists' | 'contains'
  value?: any           // expected value for eq/neq/contains
}
```

Example trigger: "Heroku + hiring DevOps"

```json
{
  "name": "Heroku companies hiring DevOps",
  "conditions": [
    { "signal_type": "hosting_detected", "field": "provider", "operator": "eq", "value": "heroku" },
    { "signal_type": "careers_page", "field": "has_devops", "operator": "eq", "value": true }
  ],
  "action": { "type": "prospect_brief", "config": {} },
  "deliveries": [{ "type": "dashboard", "config": {} }]
}
```

### Idempotency

A trigger should not fire twice for the same signal state. We track this with a **trigger_runs** dedup table:

```
trigger_runs
  id              uuid PK
  trigger_id      uuid FK → triggers
  company_id      uuid FK → companies
  signal_hash     text          -- hash of matched signal values
  action_run_id   uuid FK → action_runs
  created_at      timestamptz
  UNIQUE (trigger_id, company_id, signal_hash)
```

**`signal_hash`** = `sha256(JSON.stringify(sorted matched signal values))`

When evaluating triggers:
1. Query company's signals
2. Check each active trigger's conditions
3. If conditions match, compute `signal_hash` from the matched signal values
4. Attempt insert into `trigger_runs` — if conflict on `(trigger_id, company_id, signal_hash)`, skip (already fired for this state)
5. If insert succeeds, enqueue the action job

This means: if signals change (e.g., company switches from Heroku to Railway), the hash changes, and the trigger can fire again for the new state. But the same unchanged state won't re-trigger.

---

## 5. Action Outputs

Flexible `jsonb` for the `output` column in `action_runs`. Each action type defines its own output shape, but the system doesn't enforce it — the dashboard renders based on `action_type`.

### Output Shapes by Action Type

**prospect_brief:**
```json
{
  "summary": "string — what the company does",
  "infrastructure_assessment": "string — current hosting, inferred stack, complexity",
  "signals_summary": "string — why this company is interesting",
  "approach_angle": "string — recommended outreach strategy",
  "raw_signals": { ... }
}
```

**outreach_draft:**
```json
{
  "subject": "string",
  "body": "string",
  "context_used": ["list of signals referenced"]
}
```

**change_alert:**
```json
{
  "change_description": "string — what changed",
  "significance": "string — why it matters",
  "previous_state": { ... },
  "current_state": { ... }
}
```

**cost_analysis:**
```json
{
  "current_provider": "string",
  "estimated_current_cost": "string",
  "estimated_alternative_cost": "string",
  "assumptions": ["list of assumptions made"],
  "recommendation": "string"
}
```

**weekly_digest:**
```json
{
  "period": "string — date range",
  "highlights": [{ "company_id": "...", "summary": "..." }],
  "narrative": "string — AI-written overview"
}
```

The dashboard reads `action_type` and renders the appropriate card/layout for each shape.

---

## 6. Dashboard

### Tech

- Next.js App Router (same web service as API)
- shadcn/ui components
- Tailwind CSS
- Server components for initial data load, client components for interactivity
- No real-time updates — data is fresh on page load / manual refresh

### Company List View (Primary View)

**Layout:** Table with filterable columns

| Column | Content |
|--------|---------|
| Company | Name + one-liner + logo |
| Batch | YC batch (e.g., W24) |
| Team Size | Number |
| Hosting | Badge (Heroku, Render, Vercel, etc.) or "Unknown" |
| Hiring Signals | Badges: "DevOps", "Infra", "Platform" (from careers_page signal) |
| Tech Stack | Tags from tech_stack signal |
| Actions | Button row: "View", "Generate Brief", "Sync" |

**Filters:** Multi-select dropdowns (shadcn `Combobox` or `MultiSelect`):
- Hosting provider (multi-select)
- Signal type present (multi-select: has DevOps posting, mentions Heroku, etc.)
- YC batch (multi-select)
- Industry (multi-select)
- Team size range (slider or min/max inputs)

Filters compose with AND logic. URL params for shareability.

### Company Detail View

Reached by clicking a row. Shows:

- **Header:** Company name, logo, one-liner, website link, YC link
- **Signal cards:** One card per signal, showing type, value, detected_at, confidence
- **Crawled pages:** Accordion with extracted text per page (homepage, careers, login)
- **Action outputs:** List of AI-generated content (briefs, drafts) with timestamps
- **Actions:** "Generate Brief", "Generate Outreach", "Sync Company" buttons

### Triggers View

Simple CRUD list:
- Table of triggers with name, conditions summary, action type, status (active/inactive)
- Create/edit form:
  - Name (text input)
  - Conditions: repeatable row of [signal_type dropdown] [field input] [operator dropdown] [value input]
  - Action type (dropdown)
  - Delivery type (dropdown, with config fields based on type)
  - Active toggle

### Pipeline View

Observability:
- Collection run history (table: type, status, started_at, stats)
- Job queue depth (current pending/active/completed/failed counts from BullMQ)
- Recent failures (table: job type, company, error, timestamp)

---

## 7. Job Orchestration

### Job Types

```typescript
type JobType =
  // Collection
  | { type: 'collect:yc_directory' }
  | { type: 'scrape:homepage'; companyId: string; url: string }
  | { type: 'scrape:careers'; companyId: string; url: string }
  | { type: 'scrape:login'; companyId: string; url: string }
  | { type: 'collect:dns_detector'; companyId: string; domain: string }

  // Detection
  | { type: 'detect:hosting'; companyId: string }
  | { type: 'detect:website_analysis'; companyId: string }

  // Trigger evaluation
  | { type: 'evaluate_triggers'; companyId: string }

  // Actions
  | { type: 'action:run'; triggerId: string; companyId: string; signalIds: string[] }

  // Delivery
  | { type: 'deliver'; actionRunId: string; deliveryType: string; deliveryConfig: JsonObject }
```

### Batching Strategy

On initial YC load (~2,000-3,000 companies after filtering):
- Upsert all companies to Postgres in a single batch
- Enqueue scrape + DNS jobs in batches of 50 with a small delay between batches
- BullMQ rate limiter on scrape jobs: max 5 concurrent browser pages across all workers

On manual sync (single company):
- Enqueue all jobs for that company immediately

On "Sync All":
- Same as initial load batching

### Concurrency Limits

| Job Type | Max Concurrency | Rationale |
|----------|----------------|-----------|
| `scrape:*` | 5 | Headless browser memory constraint |
| `collect:dns_detector` | 20 | Lightweight, just DNS + HTTP |
| `detect:website_analysis` | 3 | LLM API rate limits + cost |
| `action:run` | 3 | LLM API rate limits + cost |
| `evaluate_triggers` | 10 | Pure DB queries, fast |
| `deliver` | 10 | External HTTP calls |

Configured via BullMQ worker concurrency per queue or job-type-specific rate limiters.

### Retry Policy

| Job Type | Max Retries | Backoff |
|----------|-------------|---------|
| `scrape:*` | 2 | Exponential, 30s base |
| `collect:dns_detector` | 2 | Exponential, 10s base |
| `detect:website_analysis` | 1 | Fixed, 60s (LLM retry) |
| `action:run` | 1 | Fixed, 60s |
| `evaluate_triggers` | 3 | Exponential, 5s base |
| `deliver` | 3 | Exponential, 30s base |

---

## 8. Sync Flow (End-to-End)

### Single Company Sync (user clicks "Sync" on a company)

```
1. Enqueue: scrape:homepage (companyId, website_url)
2. Enqueue: collect:dns_detector (companyId, domain)

3. Homepage scraper runs
   → Extracts text, computes hash
   → If hash unchanged: STOP (no downstream jobs)
   → If changed: write page, discover career + login links
   → Enqueue: scrape:careers (if link found)
   → Enqueue: scrape:login (if link found)

4. DNS detector runs
   → Writes hosting_detected signal (upsert)
   → Enqueue: evaluate_triggers (companyId)

5. Career scraper runs
   → Extracts text, computes hash
   → If hash unchanged: STOP
   → If changed: write page
   → Enqueue: detect:website_analysis (companyId)

6. Website analysis detector runs
   → Sends career text to LLM → extracts roles, devops flag, heroku mentions
   → Sends homepage text to LLM → extracts product profile, tech stack
   → Writes signals (upsert)
   → Enqueue: evaluate_triggers (companyId)

7. Trigger evaluation runs
   → Checks all active triggers against company's signals
   → For each match, checks signal_hash dedup
   → If new match: enqueue action:run

8. Action runs (e.g., prospect_brief)
   → Calls LLM with company data + signals
   → Writes action_run to Postgres
   → Enqueue: deliver (for each delivery on the trigger)

9. Delivery runs
   → Dashboard: no-op (action_run already in DB)
   → Slack: POST to webhook
   → Email: send via API
```

### Full Sync (user clicks "Sync All" or initial load)

Same as above but:
- Step 1-2 enqueued for all companies in batches of 50
- 500ms delay between batches to avoid queue flood
- Worker concurrency limits handle the throughput
