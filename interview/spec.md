# SignalKit: Automated AI Intelligence Pipelines

## Overview

SignalKit is an open-source framework for building automated AI intelligence pipelines from external data sources. It collects data from configurable sources, detects meaningful signals, and triggers AI-powered actions when user-defined conditions are met.

The architecture is a directed pipeline with four stages, a shared job queue, and plugin interfaces at every stage. New capabilities are added by registering plugins, not by changing the system.

**Demo use case:** GTM signal intelligence — monitoring YC-backed startups for indicators that they're ready to migrate from Heroku to a modern PaaS (hosting detection, DevOps hiring signals, team growth).

---

## Architecture

### Pipeline

```
Source → Collect → Detect → Act → Deliver
```

Every stage enqueues the next stage's jobs on completion. A single stateless worker pool processes all job types. The queue is the central nervous system.

```
┌─────────┐     ┌───────────┐     ┌──────────┐     ┌────────┐     ┌──────────┐
│  CRON   │────▶│ COLLECTORS│────▶│ DETECTORS│────▶│ ACTIONS│────▶│DELIVERIES│
│ (clock) │     │           │     │          │     │  (AI)  │     │          │
└─────────┘     └───────────┘     └──────────┘     └────────┘     └──────────┘
                     │                 │                │               │
                     ▼                 ▼                ▼               ▼
              ┌──────────────────────────────────────────────────────────────┐
              │                        POSTGRES                              │
              │  companies │ raw_data │ signals │ action_outputs │ triggers  │
              └──────────────────────────────────────────────────────────────┘
                     ▲                 ▲                ▲               ▲
                     │                 │                │               │
              ┌──────────────────────────────────────────────────────────────┐
              │                      REDIS (BullMQ)                          │
              │               job queue + rate limiting                       │
              └──────────────────────────────────────────────────────────────┘
                                        ▲
                                        │
                               ┌─────────────────┐
                               │   WORKERS (N)    │
                               │ stateless, pulls │
                               │ any job type     │
                               └─────────────────┘
```

### Plugin Interfaces

```typescript
interface Collector {
  type: string
  collect(ctx: CollectorContext): AsyncIterable<CollectedRecord>
}

interface Detector {
  signalType: string
  detect(company: Company, records: CollectedRecord[]): Signal | null
}

interface Action {
  type: string
  execute(company: Company, signals: Signal[], config: JsonObject): Promise<ActionOutput>
}

interface Delivery {
  type: string
  deliver(output: ActionOutput, config: JsonObject): Promise<void>
}
```

### Trigger (User-Configured)

Triggers connect signals to actions to deliveries:

```typescript
interface Trigger {
  id: string
  name: string
  conditions: {
    match: 'all' | 'any'
    signals: SignalCondition[]
  }
  action: {
    type: string
    config: JsonObject
  }
  deliveries: {
    type: string
    config: JsonObject
  }[]
  evaluation: 'on_new_signal' | 'daily' | 'weekly'
}
```

---

## Data Model

### companies

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| name | text | |
| slug | text UNIQUE | |
| domain | text | Primary domain |
| website_url | text | Product/marketing URL |
| logo_url | text | |
| source | text | e.g. 'yc_directory' |
| source_id | text | External ID from source |
| source_data | jsonb | Full raw record from source |
| metadata | jsonb | Flexible enrichment data |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### signals

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| company_id | uuid FK → companies | |
| signal_type | text | e.g. 'hosting_detected', 'job_posted' |
| source | text | Which collector produced this |
| value | jsonb | Signal payload |
| previous_value | jsonb | For change detection |
| confidence | real | 0.0–1.0 |
| detected_at | timestamptz | |
| expires_at | timestamptz | Signals go stale |

Indexed on `(company_id, signal_type, detected_at DESC)`.

### triggers

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| name | text | |
| conditions | jsonb | Signal filter criteria |
| action_type | text | |
| action_config | jsonb | |
| deliveries | jsonb | |
| evaluation | text | 'on_new_signal', 'daily', 'weekly' |
| is_active | boolean | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### action_runs

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| trigger_id | uuid FK → triggers | |
| company_id | uuid FK → companies | |
| signal_ids | uuid[] | Which signals caused this |
| action_type | text | |
| status | text | 'pending', 'running', 'completed', 'failed' |
| input | jsonb | What was sent to the AI |
| output | jsonb | What came back |
| error | text | |
| created_at | timestamptz | |
| completed_at | timestamptz | |

### collection_runs

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| collector_type | text | |
| status | text | |
| stats | jsonb | { found, new, updated, errors } |
| started_at | timestamptz | |
| completed_at | timestamptz | |

---

## Demo Collectors

### YC Directory Collector

- **Source:** `yc-oss.github.io/api/companies/all.json` (community dataset, MIT, updated daily)
- **Filter:** `team_size >= 1 && team_size <= 50 && status === 'Active'`
- **Yields:** Company name, domain, website URL, batch, one-liner, team size, industry, tags, hiring status
- **Schedule:** Manual (user-triggered sync)

### DNS/HTTP Hosting Detector

- **Input:** Company domain
- **Method:** DNS CNAME resolution + HTTP header fingerprinting
- **Detects:** Heroku (`*.herokuapp.com`, `Via: 1.1 vegur`), App Runner (`*.awsapprunner.com`), Railway, Fly, Render, Vercel, Netlify
- **Yields:** `hosting_detected` signal with provider, method, confidence

### Website Scrapers

Separate scrapers per page type, sharing the same storage and change-detection model. URLs are the primary key.

**Homepage Scraper:**
- **Input:** Company `website_url` from YC data
- **Method:** Headless browser (Playwright), extract `innerText`, discover links to careers + login pages
- **Yields:** Stripped page text + discovered URLs for downstream scrapers

**Careers Page Scraper:**
- **Input:** Careers URL discovered from homepage link-following
- **Method:** Headless browser, extract `innerText`
- **Yields:** Stripped page text for AI careers analysis

**Login/Product Page Scraper:**
- **Input:** Login/signup URL discovered from homepage link-following
- **Method:** Headless browser, extract `innerText`
- **Yields:** Stripped page text for AI product analysis

All scrapers use sha256 content hashing to skip re-processing unchanged pages.

---

## Demo AI Actions

### Prospect Brief

Given a company and its signals, generate a structured intelligence report:
- What the company does (from website content)
- Current infrastructure assessment (from hosting, product description + job signals)
- Recommended approach angle

### Outreach Draft

Given a company, its signals, and user-provided context (who you are, what you're pitching), generate a personalized cold outreach message that references specific signals.

### Change Alert

When a signal changes (new job posted, hosting provider changed, team grew), generate a natural language explanation of what changed and why it matters.

### Cost Analysis

Given detected hosting provider and inferred infrastructure needs (from website/product analysis), generate a rough cost comparison between current provider and alternatives.

### Weekly Digest

Scheduled action (weekly). Summarize top N new/changed prospects across the portfolio with AI-written narrative.

---

## Demo Deliveries

### Dashboard (built)

Writes to `action_runs` table. Dashboard reads and displays.

### Slack (stubbed)

POST formatted message to Slack incoming webhook URL.

### Email (stubbed)

Send via Resend/SendGrid API.

### Webhook (stubbed)

Generic HTTP POST with JSON payload to user-configured URL.

---

## Job Flow (Concrete Example)

### Initial Load / Sync All

```
1. User clicks "Sync" in dashboard (or initial load)
   └─ API enqueues: { type: 'collect:yc_directory' }

2. WORKER picks up YC collect job
   └─ Fetches community dataset from yc-oss GitHub API
   └─ Filters to team_size 1–50, status Active
   └─ Batch upserts to companies table
   └─ Enqueues enrichment jobs in batches of 50:
      ├─ { type: 'scrape:homepage', companyId, url }
      └─ { type: 'collect:dns_detector', companyId, domain }

3. WORKER picks up scrape:homepage for Acme Corp
   └─ Headless browser fetches acme.com, extracts innerText
   └─ Computes content hash — if unchanged from last scrape, STOP
   └─ If new/changed: writes page record, discovers links
   └─ Enqueues:
      ├─ { type: 'scrape:careers', companyId, url: '/careers' }
      └─ { type: 'scrape:login', companyId, url: '/app' }

4. WORKER picks up collect:dns_detector for Acme Corp
   └─ Resolves CNAME + checks HTTP headers
   └─ Upserts signal: { type: 'hosting_detected', value: { provider: 'heroku' } }
   └─ Enqueues: { type: 'evaluate_triggers', companyId }

5. WORKER picks up scrape:careers for Acme Corp
   └─ Headless browser extracts careers page text
   └─ Hash check — if unchanged, STOP
   └─ If new/changed: writes page, enqueues: { type: 'detect:website_analysis', companyId }

6. WORKER picks up detect:website_analysis
   └─ Sends stripped careers text to LLM → extracts roles, devops flag, heroku mentions
   └─ Sends stripped homepage text to LLM → extracts product profile, tech stack
   └─ Upserts signals: careers_page, product_profile, tech_stack
   └─ Enqueues: { type: 'evaluate_triggers', companyId }

7. WORKER picks up evaluate_triggers
   └─ Checks all active triggers against Acme's signals
   └─ Computes signal_hash for matched triggers, dedup check
   └─ Trigger "Heroku + DevOps hire" matches with new hash
   └─ Enqueues: { type: 'action:run', triggerId, companyId, signalIds }

8. WORKER picks up action:run (prospect_brief)
   └─ Gathers company data + signals + crawled content
   └─ Calls LLM → generates structured prospect brief
   └─ Writes action_run to Postgres
   └─ Enqueues: { type: 'deliver', actionRunId } per configured delivery

9. WORKER picks up deliver (dashboard)
   └─ No-op — action_run already in DB, dashboard reads it
```

### Single Company Sync

Same flow but starts at step 3 (scrape + DNS) for one company only.

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Language | TypeScript | Required. Type safety across services. |
| Web framework | Next.js (App Router) | Dashboard + API in one service |
| Database | PostgreSQL | Relational data + JSONB flexibility |
| Queue | BullMQ on Redis | Job chaining, retries, rate limiting, priorities |
| Key-Value | Redis (Render managed) | BullMQ backend + caching |
| AI | Anthropic Claude API | Structured output, long context for website analysis |
| ORM | Drizzle | Lightweight, type-safe, good JSONB support |
| UI | React + Tailwind | Fast, minimal CSS overhead |

---

## Render Deployment Topology

| Service | Render Type | Role |
|---------|-------------|------|
| `web` | Web Service | Next.js dashboard + REST API |
| `worker` | Background Worker | Stateless job processor (all job types) |
| `cron` | Cron Job | Enqueues scheduled trigger evaluations (weekly digest, daily alerts) |
| `postgres` | Managed Database | Primary datastore |
| `redis` | Key-Value Store | BullMQ job queue + caching |

### render.yaml (Blueprint)

```yaml
services:
  - type: web
    name: signalkit-web
    runtime: node
    plan: starter
    buildCommand: npm run build
    startCommand: npm run start:web
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: signalkit-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: signalkit-redis
          type: keyvalue
          property: connectionString
      - key: ANTHROPIC_API_KEY
        sync: false

  - type: worker
    name: signalkit-worker
    runtime: node
    plan: starter
    buildCommand: npm run build
    startCommand: npm run start:worker
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: signalkit-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: signalkit-redis
          type: keyvalue
          property: connectionString
      - key: ANTHROPIC_API_KEY
        sync: false

  - type: cron
    name: signalkit-cron
    runtime: node
    plan: starter
    buildCommand: npm run build
    startCommand: npm run start:cron
    schedule: "0 6 * * 1"  # Weekly (Mondays 6am) — evaluates scheduled triggers like weekly digest
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: signalkit-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: signalkit-redis
          type: keyvalue
          property: connectionString

databases:
  - name: signalkit-db
    plan: starter

keyValueStores:
  - name: signalkit-redis
    plan: starter
```

---

## Module Structure

```
src/
  core/
    types.ts              -- Company, Signal, Trigger, ActionOutput, etc.
    registry.ts           -- Plugin registry
    pipeline.ts           -- Job dispatch routing

  queue/
    client.ts             -- BullMQ queue/worker wrapper
    jobs.ts               -- Job type definitions

  db/
    schema.ts             -- Drizzle schema
    migrations/
    queries/

  ai/
    client.ts             -- LLM abstraction (Anthropic SDK)
    prompts/              -- Prompt templates per action type

  collectors/
    yc-directory.ts       -- Fetch YC community dataset from GitHub, filter, upsert
    dns-detector.ts       -- CNAME resolution + HTTP header fingerprinting

  scrapers/
    homepage.ts           -- Headless browser: extract text + discover career/login links
    careers.ts            -- Headless browser: extract careers page text
    login.ts              -- Headless browser: extract login/product page text
    shared.ts             -- Playwright helpers, content hashing, link discovery

  detectors/
    hosting.ts            -- Combine DNS/HTTP signals into hosting_detected
    website-analysis.ts   -- AI-powered: extract product info, tech stack, job postings, infra signals from crawled pages
    team-growth.ts        -- Detect team size changes over time

  actions/
    prospect-brief.ts
    outreach-draft.ts
    change-alert.ts
    cost-analysis.ts
    weekly-digest.ts

  deliveries/
    dashboard.ts          -- Writes to action_runs (dashboard reads from there)
    slack.ts              -- Slack incoming webhook (stubbed)
    email.ts              -- Resend/SendGrid (stubbed)
    webhook.ts            -- Generic HTTP POST (stubbed)

  services/
    web/                  -- Next.js app (API routes + dashboard UI)
    worker/               -- BullMQ worker process
    cron/                 -- Scheduled job enqueuer
```

---

## Dashboard (Web Service)

### Views

- **Companies list** — filterable table with signal indicators (hosting badge, hiring signals, tech stack, team size)
- **Company detail** — timeline of signals, crawled page summaries, AI-generated briefs, raw data
- **Triggers** — CRUD interface for configuring trigger rules
- **Pipeline** — observability view showing collection runs, job throughput, success/failure rates
- **Action outputs** — browseable list of AI-generated content (briefs, drafts, alerts, digests)

### API Routes

- `GET /api/companies` — list with filters
- `GET /api/companies/:id` — detail with signals and action outputs
- `GET /api/signals` — list/filter signals
- `POST /api/triggers` — create trigger
- `GET /api/triggers` — list triggers
- `PUT /api/triggers/:id` — update trigger
- `GET /api/action-runs` — list action outputs
- `GET /api/pipeline/stats` — collection run stats, queue depth

---

## Design Principles

1. **Signals are the lingua franca.** Collectors produce them. Triggers query them. Actions consume them. Everything speaks signals.

2. **Everything is a job.** Collection, detection, AI analysis, delivery — all jobs in the same queue. Workers don't specialize.

3. **Adding capabilities is additive.** New data source = new collector. New AI feature = new action. New output channel = new delivery. Nothing else changes.

4. **Full provenance.** Every action output traces back through: delivery ← action_run ← trigger ← signals ← collection_run.

5. **Horizontal scaling is free.** Add worker replicas. They all pull from the same queue. Rate limiting is per-job-type via BullMQ.

6. **AI is a pipeline stage, not the whole product.** The deterministic pipeline collects and routes. AI handles the tasks that genuinely require intelligence (analysis, synthesis, generation).

---

## Extensibility (Other Use Cases)

The architecture supports any "collect external data → detect patterns → act with AI → deliver" workflow:

- **Security monitoring** — collect CVE feeds, detect matches against tracked deps, AI generates impact assessments
- **Competitive intelligence** — monitor competitor job boards/changelogs, AI generates competitive briefs
- **Recruiting** — scan job boards for target roles, AI analyzes fit and generates application notes
- **Open source ecosystem** — track GitHub repos/releases, AI summarizes relevance

These require only new plugin implementations, not architectural changes.
