# SignalKit

AI-powered intelligence pipelines for automated data collection, signal detection, and action generation.

## What It Does

SignalKit monitors external data sources, detects meaningful signals using AI, and triggers automated actions when conditions are met. The demo use case tracks YC-backed startups to identify companies ready to migrate hosting providers.

**Pipeline:** Source → Collect → Detect → Act → Deliver

```
┌─────────┐     ┌───────────┐     ┌──────────┐     ┌────────┐     ┌──────────┐
│  CRON   │────▶│ COLLECTORS│────▶│ DETECTORS│────▶│ ACTIONS│────▶│DELIVERIES│
│ (clock) │     │           │     │          │     │  (AI)  │     │          │
└─────────┘     └───────────┘     └──────────┘     └────────┘     └──────────┘
                     │                 │                │               │
                     ▼                 ▼                ▼               ▼
              ┌──────────────────────────────────────────────────────────────┐
              │                        POSTGRES                              │
              └──────────────────────────────────────────────────────────────┘
                                        ▲
              ┌──────────────────────────────────────────────────────────────┐
              │                    REDIS (BullMQ)                            │
              └──────────────────────────────────────────────────────────────┘
```

## Why These Decisions

**Everything is a job.** Collection, detection, AI analysis, delivery — all jobs in the same BullMQ queue. Workers are stateless and pull any job type. This means horizontal scaling is free: add more worker instances and they all pull from the same queue.

**Signals are the lingua franca.** Collectors produce them, triggers query them, actions consume them. Decoupling pipeline stages through signals means you can rewire the system by changing trigger conditions, not code.

**Plugin architecture.** New data source? Write a collector, register it. New AI feature? Write an action, register it. Nothing else changes. The system follows the Open/Closed Principle — extending capabilities is additive, never invasive.

**AI is a pipeline stage, not the whole product.** The deterministic pipeline collects and routes data. AI handles tasks that genuinely require intelligence: analyzing careers pages for DevOps roles, generating prospect briefs, writing personalized outreach.

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Language | TypeScript | Type safety across all services |
| Web | Next.js 16 (App Router) | Dashboard + API in one service |
| Database | PostgreSQL | Relational data + JSONB flexibility |
| Queue | BullMQ on Redis | Job chaining, retries, rate limiting |
| AI | Anthropic Claude | Structured output, long context |
| ORM | Drizzle | Lightweight, type-safe, good JSONB support |
| UI | React + Tailwind CSS | Fast, minimal CSS overhead |
| Testing | Vitest | Fast, native TS support |

## Render Deployment

SignalKit deploys as a multi-service application using Render Blueprint:

| Service | Type | Role |
|---------|------|------|
| `signalkit-web` | Web Service | Next.js dashboard + REST API |
| `signalkit-worker` | Background Worker | Stateless job processor |
| `signalkit-cron` | Cron Job | Weekly scheduled evaluations |
| `signalkit-db` | PostgreSQL | Primary datastore |
| `signalkit-redis` | Key-Value Store | BullMQ job queue |

### Deploy with Blueprint

1. Fork this repository
2. In Render Dashboard, click **New** → **Blueprint**
3. Connect your fork and select the `render.yaml` file
4. Set the `ANTHROPIC_API_KEY` environment variable
5. Render provisions all five services automatically

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL (local or Docker)
- Redis (local or Docker)

### Setup

```bash
cd signalkit

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your local Postgres/Redis URLs and Anthropic API key

# Generate and run database migrations
npm run db:generate
npm run db:migrate

# Start all services in development mode
npm run dev          # Next.js web server (port 3000)
npm run start:worker # Background worker (separate terminal)
```

### Running Tests

```bash
npm test           # Run all 277 tests
npm run test:watch # Watch mode
```

## Project Structure

```
src/
  core/
    types.ts              — Plugin interfaces, job payload types, trigger conditions
    registry.ts           — Plugin registry (register/retrieve collectors, detectors, actions, deliveries)
    trigger-evaluator.ts  — Condition evaluation, signal hashing, dedup logic
    trigger-service.ts    — Orchestrates trigger evaluation flow

  queue/
    client.ts             — BullMQ queue wrapper with IQueueClient interface
    jobs.ts               — Job type constants, concurrency limits, retry policies
    dispatcher.ts         — Routes jobs to registered handlers

  db/
    schema.ts             — Drizzle schema (7 tables: companies, pages, signals, triggers, trigger_runs, action_runs, collection_runs)
    connection.ts         — Lazy singleton DB connection
    queries/              — Query functions per domain (companies, signals, triggers, etc.)

  ai/
    client.ts             — IAIClient interface with Anthropic implementation + mock
    prompts/              — Zod-validated prompt templates (careers analysis, product analysis)

  collectors/
    yc-directory.ts       — Fetches YC company data, filters, yields CollectedRecords
    dns-detector.ts       — DNS CNAME + HTTP header hosting detection
    yc-upsert.ts          — Batch upserts companies to Postgres
    handler.ts            — Orchestrates collection workflow

  scrapers/
    shared.ts             — Content hashing, link discovery, text cleanup
    browser.ts            — IBrowserManager interface (Playwright + mock)
    page-repository.ts    — IPageRepository for page CRUD
    homepage.ts           — Homepage scraper with link discovery
    careers.ts            — Careers page scraper
    login.ts              — Login/product page scraper

  detectors/
    hosting.ts            — Wraps DNS detector into Detector interface
    website-analysis.ts   — AI-powered extraction of signals from page content

  actions/
    prospect-brief.ts     — Generates structured prospect intelligence report
    outreach-draft.ts     — Generates personalized cold outreach
    change-alert.ts       — Describes signal changes in natural language
    cost-analysis.ts      — Compares hosting costs across providers
    weekly-digest.ts      — Summarizes top prospects across portfolio

  deliveries/
    dashboard.ts          — No-op (action runs are already in DB)
    slack.ts              — Slack webhook (stubbed)
    email.ts              — Email via Resend/SendGrid (stubbed)
    webhook.ts            — Generic HTTP POST (stubbed)

  services/
    worker/               — BullMQ worker entry point
    cron/                 — Scheduled job enqueuer

  app/                    — Next.js App Router
    api/                  — REST API routes
    companies/            — Company list + detail pages
    triggers/             — Trigger management page
    pipeline/             — Pipeline observability page
    actions/              — AI output browser
    components/           — Reusable UI components

__tests__/                — 28 test files, 277 tests mirroring src structure
```

## Adding New Capabilities

### New Data Source (Collector)

```typescript
// src/collectors/my-source.ts
import type { Collector, CollectorContext, CollectedRecord } from '@/core/types';

export class MySourceCollector implements Collector {
  readonly type = 'my_source';

  async *collect(ctx: CollectorContext): AsyncGenerator<CollectedRecord> {
    // Fetch data from your source
    // Yield CollectedRecord for each item
  }
}

// Register in your worker setup:
registry.registerCollector(new MySourceCollector());
```

### New AI Action

```typescript
// src/actions/my-action.ts
import { z } from 'zod';
import type { IAIClient } from '@/ai/client';

const MyOutputSchema = z.object({ /* your output shape */ });

export class MyAction {
  readonly type = 'my_action';
  constructor(private readonly aiClient: IAIClient) {}

  async execute(company: CompanyContext, signals: SignalContext[]) {
    return this.aiClient.analyze(prompt, MyOutputSchema);
  }
}
```

### New Delivery Channel

```typescript
// src/deliveries/my-channel.ts
export class MyDelivery {
  readonly type = 'my_channel';

  async deliver(actionRunId: string, config: Record<string, unknown>) {
    // Send output to your channel (Slack, email, webhook, etc.)
  }
}
```

## Design Principles

1. **Dependency Inversion** — All components depend on interfaces (`IAIClient`, `IBrowserManager`, `IPageRepository`, `IQueueClient`), not concrete implementations. This enables testing with mocks and swapping implementations.

2. **Single Responsibility** — Each file has one job. Collectors fetch data. Repositories persist it. Scrapers extract content. Detectors analyze it. Actions generate output.

3. **Open/Closed** — The plugin registry allows adding capabilities without modifying existing code. New collectors, detectors, actions, and deliveries are registered, not hard-coded.

4. **Full Provenance** — Every action output traces back through: delivery ← action_run ← trigger ← signals ← collection_run.

5. **Test-Driven** — 277 tests covering core logic, plugins, AI schemas, and API validation. All tests use dependency injection with mocks — no database or Redis required.
