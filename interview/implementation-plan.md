# SignalKit: Implementation Plan

## Phase 1 — Foundation

Get the skeleton running: monorepo structure, database, queue, and a minimal worker that can process a job end-to-end. Nothing AI, nothing scraped. Just proof that the pipeline works.

### 1.1 Project Setup

- Initialize monorepo with TypeScript, `tsconfig`, ESLint, Prettier
- Install core dependencies: `next`, `drizzle-orm`, `drizzle-kit`, `bullmq`, `ioredis`, `pg`
- Set up `src/` module structure per spec (core, queue, db, collectors, scrapers, detectors, actions, deliveries, services)
- Create npm scripts: `start:web`, `start:worker`, `start:cron`, `dev` (runs all locally)
- Create `render.yaml` blueprint (can deploy empty services to verify infra)

### 1.2 Database Schema & Migrations

- Define Drizzle schema for all tables:
  - `companies` (with `source_data` jsonb)
  - `pages` (with `content_hash`)
  - `signals` (with unique constraint on `company_id, signal_type`)
  - `triggers`
  - `trigger_runs` (with unique constraint on `trigger_id, company_id, signal_hash`)
  - `action_runs`
  - `collection_runs`
- Generate and run initial migration
- Write seed script that inserts a handful of test companies manually

### 1.3 Core Types & Plugin Registry

- Define TypeScript interfaces: `Company`, `Signal`, `Trigger`, `ActionOutput`, `CollectedRecord`
- Define plugin interfaces: `Collector`, `Detector`, `Action`, `Delivery`
- Build plugin registry: `registerCollector()`, `registerDetector()`, etc.
- Define job type union and serialization

### 1.4 Queue & Worker Bootstrap

- Set up BullMQ queue client (`src/queue/client.ts`)
- Build job dispatcher: given a job payload, look up handler from registry and execute
- Build worker entry point (`src/services/worker/index.ts`) that connects to Redis and processes jobs
- Build a trivial test collector (e.g., returns 3 hardcoded companies) to verify the full loop: enqueue → worker picks up → writes to DB
- Verify locally: start Redis, start worker, enqueue a job via script, see it complete

**Milestone:** Worker processes a test job and writes to Postgres. Pipeline plumbing works.

---

## Phase 2 — Data Collection

Wire up the real data sources. After this phase, the database is populated with real YC companies, hosting detection results, and scraped page content. No AI yet.

### 2.1 YC Directory Collector

- Fetch `https://yc-oss.github.io/api/companies/all.json`
- Filter: `team_size >= 1 && team_size <= 50 && status === 'Active'`
- Parse domain from `website` field
- Batch upsert to `companies` table (ON CONFLICT on `source_id`)
- Track stats in `collection_runs` (found, new, updated)
- After upsert, enqueue `scrape:homepage` + `collect:dns_detector` jobs in batches of 50
- Expose via API route: `POST /api/sync` (triggers YC collection)

### 2.2 DNS/HTTP Hosting Detector

- Implement `dns.resolveCname()` for domain + `www.` prefix
- Implement `fetch()` HEAD request for header fingerprinting
- Match against provider signatures table (Heroku, App Runner, Render, Railway, Fly, Vercel, Netlify)
- Upsert `hosting_detected` signal with provider, method, confidence
- Enqueue `evaluate_triggers` (no-ops for now since no triggers exist yet)

### 2.3 Website Scrapers

- Install Playwright (`playwright` + `@playwright/test` for browser binaries)
- Build shared scraper utilities (`src/scrapers/shared.ts`):
  - `launchBrowser()` — singleton browser instance per worker
  - `extractText(url)` — navigate, wait for idle, return `innerText`
  - `extractLinks(url)` — return all `<a>` hrefs
  - `contentHash(text)` — sha256
- **Homepage scraper:**
  - Extract text, compute hash, compare to `pages` table
  - If new/changed: write page, run link discovery heuristics, enqueue downstream scrape jobs
  - If unchanged: stop
- **Careers scraper:**
  - Extract text, compute hash, write to `pages`
  - If new/changed: enqueue `detect:website_analysis`
- **Login scraper:**
  - Same as careers but writes with `page_type: 'login'`
  - Enqueue `detect:website_analysis`
- Configure BullMQ concurrency: max 5 for `scrape:*` jobs

### 2.4 API: Sync Endpoints

- `POST /api/sync` — trigger full YC collection + enrichment pipeline
- `POST /api/companies/:id/sync` — trigger single-company scrape + DNS pipeline
- Return job IDs so the UI can (eventually) track progress

**Milestone:** Run a full sync. Database has ~2,000-3,000 companies with real YC data, hosting detection signals for all, scraped page content for those with reachable sites.

---

## Phase 3 — AI Detection & Signals

Add the AI layer that turns raw scraped content into structured signals. After this phase, every company has a set of machine-readable signals derived from their web presence.

### 3.1 AI Client

- Set up Anthropic SDK (`@anthropic-ai/sdk`)
- Build AI client abstraction (`src/ai/client.ts`):
  - `analyze(prompt, schema)` — sends prompt, validates response against Zod schema, retries once on validation failure
  - Handles rate limiting, error logging
- Define Zod schemas for each AI output shape:
  - `CareersAnalysisSchema` — roles array, has_devops, has_infra, mentions_heroku
  - `ProductAnalysisSchema` — description, category, likely_stack, complexity

### 3.2 Website Analysis Detector

- **Careers analysis path:**
  - Load careers page `content_text` from `pages` table
  - Truncate to 4,000 words if needed
  - Send to LLM with careers analysis prompt
  - Validate with Zod
  - Upsert `careers_page` signal
- **Product analysis path:**
  - Load homepage + login page `content_text`
  - Send to LLM with product analysis prompt
  - Validate with Zod
  - Upsert `product_profile` + `tech_stack` signals
- After all signals written, enqueue `evaluate_triggers`
- BullMQ concurrency: max 3 for `detect:website_analysis`

### 3.3 Prompt Engineering

- Write and iterate on prompts for:
  - Careers page analysis (role extraction, DevOps detection, Heroku mention detection)
  - Product page analysis (product description, tech stack inference, complexity assessment)
- Test against a sample of 20-30 real scraped pages to validate output quality
- Store prompts in `src/ai/prompts/` as template strings

**Milestone:** Run sync on a subset of companies. Each company now has `hosting_detected`, `careers_page`, `product_profile`, and `tech_stack` signals populated from real data. The raw data and AI-extracted signals are both in the database.

---

## Phase 4 — Triggers & Actions

Wire up the trigger evaluation engine and the first AI action (prospect brief). After this phase, the full pipeline works end-to-end: data in → signals detected → triggers fire → AI generates output.

### 4.1 Trigger Evaluation Engine

- Build trigger condition evaluator (`src/core/trigger-evaluator.ts`):
  - Load company's signals
  - For each active trigger, check all conditions against signals
  - Support operators: `eq`, `neq`, `exists`, `contains`
  - Field access into signal `value` JSONB (single-level dot path)
- Build signal hash computation for dedup
- Attempt insert into `trigger_runs` — skip on conflict
- If new match: enqueue `action:run`

### 4.2 Prospect Brief Action

- Load company + signals + relevant page content
- Build prompt that synthesizes all data into a structured brief
- Call LLM via AI client
- Write `action_run` with status tracking (pending → running → completed/failed)
- Enqueue delivery jobs

### 4.3 Dashboard Delivery

- Implement dashboard delivery: no-op (action_run is already written to DB)
- This is the default delivery — action outputs are visible in the dashboard

### 4.4 Seed Default Trigger

- On first deploy / DB seed, create a default trigger:
  - Name: "Heroku companies hiring DevOps"
  - Conditions: `hosting_detected.provider = 'heroku'` AND `careers_page.has_devops = true`
  - Action: `prospect_brief`
  - Delivery: `dashboard`
- User can modify or delete this, but it provides an immediate demo out of the box

**Milestone:** Full pipeline works. Sync companies → signals detected → trigger fires for Heroku+DevOps companies → AI generates prospect brief → visible in database. No UI yet, but verifiable via API / DB queries.

---

## Phase 5 — Dashboard

Build the web UI. The goal is a functional, good-looking dashboard using shadcn that lets users browse companies, view signals and AI outputs, configure triggers, and trigger syncs.

### 5.1 Layout & Navigation

- Set up Next.js App Router with layout
- Install and configure shadcn/ui + Tailwind
- Build app shell: sidebar nav with Companies, Triggers, Pipeline sections
- Implement responsive layout

### 5.2 Companies List View

- Server component that queries companies with signals joined
- shadcn `DataTable` with columns: Company (name + logo + one-liner), Batch, Team Size, Hosting (badge), Hiring Signals (badges), Tech Stack (tags)
- Multi-select filter dropdowns for: hosting provider, signal types, YC batch, industry
- Team size range filter
- URL param serialization for filters
- Row click → navigates to company detail
- Row actions: "Sync", "Generate Brief"
- "Sync All" button in header

### 5.3 Company Detail View

- Route: `/companies/[id]`
- Header card: name, logo, one-liner, website link, YC link, batch, team size
- Signal cards: grid of cards, one per signal (type, value summary, detected_at, confidence badge)
- Crawled pages: collapsible accordion showing extracted text per page
- Action outputs: chronological list of AI-generated content, rendered by action_type
- Action buttons: "Sync Company", "Generate Brief", "Generate Outreach"

### 5.4 Triggers View

- Route: `/triggers`
- Table: name, conditions summary (human-readable), action type, delivery type, active toggle
- Create/edit dialog:
  - Name text input
  - Conditions: repeatable rows with [signal_type select] [field input] [operator select] [value input]
  - Add/remove condition rows
  - Action type select
  - Delivery type select (with config fields)
  - Active toggle
- Delete with confirmation

### 5.5 Pipeline View

- Route: `/pipeline`
- Collection runs table: type, status, started_at, completed_at, stats (items found/new/errors)
- Job queue stats: pending, active, completed, failed counts (fetched from BullMQ via API)
- Recent failures table: job type, company, error message, timestamp

### 5.6 Sync Status Feedback

- When user clicks "Sync" or "Sync All", show a toast notification
- Companies list shows a subtle "syncing" indicator (spinner on the row) that clears on page refresh
- Pipeline view shows the active collection run

**Milestone:** Full working application. User can browse companies, filter by signals, view AI-generated briefs, configure triggers, trigger syncs, and monitor the pipeline.

---

## Phase 6 — Remaining Actions & Deliveries

Build out the rest of the AI actions and stub the delivery integrations.

### 6.1 Outreach Draft Action

- Prompt: given company data + signals + user context, generate personalized outreach
- UI: "Generate Outreach" button on company detail opens a dialog where user provides context (who they are, what they're pitching)
- Writes action_run, displayed in company detail

### 6.2 Change Alert Action

- Compares `previous_value` with current `value` on signals
- Generates natural language description of what changed and why it matters
- Triggered by re-sync when signal values differ

### 6.3 Cost Analysis Action

- Given `hosting_detected` signal + `product_profile` signal
- Generates estimated cost comparison (current provider vs. alternatives)
- Displayed as a card in company detail

### 6.4 Weekly Digest Action

- Aggregates across all companies (not per-company)
- Cron job enqueues this weekly
- Summarizes top new/changed prospects with AI narrative
- Displayed in a dedicated "Digests" section of the dashboard

### 6.5 Delivery Stubs

- **Slack**: accept webhook URL in delivery config, format output as Slack blocks, POST. Stubbed with a log message if no URL configured.
- **Email**: accept email address in config, format as HTML email. Stubbed with a log message.
- **Webhook**: accept URL in config, POST JSON payload. Stubbed with a log message.

**Milestone:** All five action types functional. Delivery integrations stubbed and ready for real credentials.

---

## Phase 7 — Polish & Deploy

Final pass: deployment, README, cleanup, demo preparation.

### 7.1 Render Deployment

- Finalize `render.yaml` blueprint
- Deploy to Render: web service, worker, cron, Postgres, Redis
- Set environment variables (DATABASE_URL, REDIS_URL, ANTHROPIC_API_KEY)
- Verify full pipeline works in production
- Run initial sync with real data

### 7.2 README

- Project overview and architecture diagram
- Why key decisions were made (not just what was built)
- Local development setup
- Blueprint deployment walkthrough
- How to add a new collector, detector, action, or delivery
- Other use cases the architecture supports

### 7.3 Cleanup

- Error handling audit: ensure all jobs fail gracefully and log useful errors
- Loading states on all dashboard interactions
- Empty states for companies list, signals, action outputs
- Mobile-responsive check on key views

### 7.4 Demo Preparation

- Seed the database with a full YC sync
- Ensure at least a few companies have all signals populated (hosting + careers + product)
- Create the default "Heroku + DevOps" trigger
- Generate prospect briefs for matched companies
- Verify the dashboard tells a compelling story end-to-end

**Milestone:** Live on Render. README written. Demo-ready with real data.

---

## Phase Summary

| Phase | What's Built | Key Deliverable |
|-------|-------------|-----------------|
| 1 | Foundation | Worker processes jobs, writes to Postgres |
| 2 | Data Collection | Database full of real YC companies with hosting + scraped pages |
| 3 | AI Detection | Structured signals extracted from websites by LLM |
| 4 | Triggers & Actions | Full pipeline: signal → trigger → AI action → output |
| 5 | Dashboard | Functional UI with filters, detail views, trigger config |
| 6 | Remaining Actions | All 5 action types, delivery stubs |
| 7 | Polish & Deploy | Live on Render, README, demo-ready |

Each phase produces a working, testable increment. No phase depends on a later phase. If time gets tight, phase 6 is the natural cut point — phases 1-5 produce a complete, demo-able application with one action type.
