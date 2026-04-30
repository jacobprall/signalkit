# SignalKit

**Automated sales intelligence on Render.** SignalKit monitors companies, detects buying signals with AI, and generates prospect briefs + outreach drafts — all running as a managed multi-service app deployed in one click via Render Blueprint.

The included demo pipeline tracks YC-backed startups: it detects hosting providers, scrapes careers/product pages, identifies infrastructure migration signals, and writes personalized outreach — hands-free, on a weekly schedule.

## What's Included

| Capability | How It Works |
|-----------|--------------|
| **Company ingestion** | Pull from data sources (YC directory included out of the box) |
| **Page enrichment** | Automatically scrape homepage, careers, and login pages for content changes |
| **Signal detection** | AI identifies hosting stack, hiring patterns, and product signals |
| **Prospect briefs** | Claude generates structured intelligence reports per company |
| **Outreach drafts** | Personalized cold emails based on detected signals |
| **Cost analysis** | Hosting cost comparisons to arm your pitch |
| **Change alerts** | Get notified when a prospect's signals change |
| **Weekly digest** | Top prospects summarized across the portfolio |
| **Trigger rules** | Define conditions ("hosting = Heroku AND hiring DevOps") to automate actions |

## One-click Deploy to Render 

SignalKit uses a [Render Blueprint](https://render.com/docs/infrastructure-as-code) (`render.yaml`) to provision everything:

| Service | Render Type | What It Does |
|---------|-------------|--------------|
| `signalkit-web` | Web Service | Dashboard UI + REST API (Next.js) |
| `signalkit-worker` | Background Worker | Processes collection, enrichment, detection, and AI jobs |
| `signalkit-cron` | Cron Job | Fires weekly (Mon 06:00 UTC) to kick off the full pipeline |
| `signalkit-db` | PostgreSQL | Stores companies, pages, signals, triggers, and action outputs |
| `signalkit-redis` | Key-Value Stored | Job queue (BullMQ) for reliable async processing |

### Get running

1. **Fork** this repo.
2. In Render Dashboard: **New** → **Blueprint** → connect your fork → select `render.yaml`.
3. Set one secret: **`ANTHROPIC_API_KEY`** (get one at [console.anthropic.com](https://console.anthropic.com)).
4. Done. Render provisions all five services, wires networking, and starts collecting.

`ANTHROPIC_MODEL` defaults to `claude-sonnet-4-20250514`. Override in the Render environment if you want a different model.

## Documentation

| Guide | What it covers |
|-------|---------------|
| [Deploy Guide](docs/deploy-guide.md) | Step-by-step tutorial from fork to AI-generated output, with checkpoints at every stage |
| [Architecture Deep Dive](docs/architecture.md) | Plugin system, dependency injection, job architecture, enricher chaining, trigger evaluation, AI integration, testing strategy |
| [Render Deployment Patterns](docs/render-patterns.md) | Line-by-line Blueprint walkthrough, web/worker/cron patterns, env wiring, scaling, and a template for your own app |
| [Workflows](docs/workflows.md) | Example workflows supported today and future directions for extension |

## How the Pipeline Works

```
  ┌──────────┐     ┌───────────┐     ┌──────────┐     ┌──────────┐     ┌────────┐     ┌──────────┐
  │   CRON   │────▶│ COLLECTOR │────▶│ ENRICHER │────▶│ DETECTOR │────▶│ ACTION │────▶│ DELIVERY │
  │ (weekly) │     │ (sources) │     │ (scrape) │     │  (+ AI)  │     │  (AI)  │     │          │
  └──────────┘     └───────────┘     └──────────┘     └──────────┘     └────────┘     └──────────┘
                         │                │                │                │               │
                         └────────────────┴────────────────┴────────────────┴───────────────┘
                                                   ▼
                                     ┌──────────────────────────┐
                                     │  POSTGRES + REDIS (Queue) │
                                     └──────────────────────────┘
```

1. **Collect** — Ingest companies from external sources (YC API, or plug in your CRM/Salesforce/Apollo export).
2. **Enrich** — Scrape each company's website for homepage content, careers pages, and login/product pages.
3. **Detect** — Run signal detectors: DNS-based hosting detection, AI-powered page analysis (careers hiring signals, product/tech stack extraction).
4. **Trigger** — Evaluate rules you define ("signal X exists AND confidence > 0.8") to decide which companies need action.
5. **Act** — Claude generates structured output: prospect briefs, outreach emails, cost comparisons, change alerts.
6. **Deliver** — Results land in the dashboard (and optionally Slack, email, or webhook — channels are ready to configure).

Every step is a **BullMQ job** processed by the worker. Jobs retry on failure, respect concurrency limits, and maintain full audit trails in Postgres.

## Dashboard

The built-in Next.js dashboard gives you:

- **Companies** — Browse your portfolio with enrichment status and detected signals.
- **Sources** — View data sources, trigger collection runs manually, see run history.
- **Triggers** — Create rules ("hosting = Heroku AND team_size < 30 → generate outreach draft").
- **Actions** — Browse AI-generated outputs (briefs, emails, alerts) per company.
- **Pipeline** — Observability view: job stats, success rates, recent runs.

## Observability

All services log structured JSON to stdout using [Pino](https://getpino.io). Every AI call emits an `llm_call` event with model, action name, company ID, latency, and token counts. In local development logs are pretty-printed automatically.

**To connect a log aggregator in production:** go to **Render Dashboard → Account Settings → Log Streams** and choose Betterstack, Datadog, Grafana Cloud, or Papertrail. No code changes or new environment variables required — Render forwards stdout directly.

See the [Deploy Guide observability section](docs/deploy-guide.md#observability-logs-and-llm-telemetry) for setup instructions and example queries.

Set `LOG_LEVEL=debug` on any service for more verbose output.

## Extending for Your Use Case

SignalKit is built as a plugin system. You don't need to understand the internals to add new data sources or AI actions.

### Add a new data source

```typescript
// src/collectors/my-crm.ts
import { defineCollector, type CollectedRecord } from '@/core/define-plugin';

export function createMyCRMCollector() {
  return defineCollector({
    name: 'my_crm',
    async *collect(_ctx): AsyncGenerator<CollectedRecord> {
      const accounts = await fetchFromCRM();
      for (const account of accounts) {
        yield { source: 'my_crm', sourceId: account.id, data: account };
      }
    },
  });
}
```

Register it in `src/services/bootstrap.ts` and it joins the pipeline automatically.

### Add a new AI action

```typescript
// src/actions/competitor-analysis.ts
import { z } from 'zod';
import { defineAIAction } from './base';

const CompetitorSchema = z.object({
  competitors: z.array(z.string()),
  positioning: z.string(),
  vulnerabilities: z.string(),
});

export function createCompetitorAnalysisAction(aiClient) {
  return defineAIAction(aiClient, {
    name: 'competitor_analysis',
    schema: CompetitorSchema,
    maxTokens: 2000,
    buildPrompt(company, signals, _config) {
      return `Analyze competitors for ${company.name}...`;
    },
  });
}
```

### Add a delivery channel

Slack, email, and webhook delivery stubs are already in place at `src/deliveries/`. Fill in your Slack webhook URL or SendGrid key and outputs flow there automatically when configured on a trigger.

## Tech Stack

| Component | Technology | Why |
|-----------|------------|-----|
| Runtime | TypeScript + Node.js 20 | End-to-end type safety |
| Web framework | Next.js 16 (App Router) | Dashboard + API in one deployable |
| Database | PostgreSQL (Render managed) | Relational data + JSONB flexibility |
| Queue | BullMQ on Redis (Render managed) | Reliable job processing with retries |
| AI | Anthropic Claude SDK | Structured outputs, long context for page analysis |
| ORM | Drizzle | Lightweight, typed, great JSONB support |
| UI | React 19 + Tailwind CSS 4 | Fast, modern dashboard |
| Scraping | Playwright | Headless browser for page enrichment |
| Testing | Vitest 4 | 430 passing tests, includes TypeScript type checking |

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL (local or Docker)
- Redis (local or Docker)

### Setup

```bash
npm install

cp .env.example .env
# Fill in: DATABASE_URL, REDIS_URL, ANTHROPIC_API_KEY

npm run db:generate
npm run db:migrate
```

### Run

```bash
npm run dev            # Dashboard at http://localhost:3000
npm run start:worker   # Job processor (separate terminal)
npm run start:cron     # Optional: trigger scheduled pipeline locally
```

### Tests

```bash
npm test               # 430 tests + type checking (no DB/Redis needed)
npm run test:watch     # Watch mode for development
npm run typecheck      # tsc --noEmit
```

All tests use dependency injection with mocks — no running infrastructure required.

## Project Layout

```
src/
  core/           — Plugin system (defineCollector, defineEnricher, defineDetector, defineAction, defineDelivery)
                    Trigger evaluation, signal hashing, registry
  services/       — bootstrap.ts (wires everything), worker entry, cron entry
  queue/          — BullMQ client, job definitions, dispatcher
  db/             — Drizzle schema (7 tables), connection, query modules
  ai/             — Anthropic client + Zod-validated prompt templates
  collectors/     — Data source plugins (YC directory)
  enrichers/      — Page enrichment plugins (homepage, careers, login)
  scrapers/       — Playwright browser management, page persistence, content hashing
  detectors/      — Signal detection plugins (hosting, AI website analysis)
  actions/        — AI action plugins (prospect brief, outreach, cost analysis, alerts, digest)
  deliveries/     — Output channels (dashboard, Slack, email, webhook)
  app/            — Next.js pages + API routes + UI components
__tests__/        — Mirrors src/ structure, all mocked (no infra needed)
render.yaml       — Render Blueprint (deploy config)
```

### Why Render?

- **One YAML, five services.** `render.yaml` declares the web app, worker, cron job, Postgres, and Redis together. `git push` deploys them all — no Terraform modules, no Docker Compose, no separate CI/CD pipeline for infra. Render resolves inter-service references (`fromDatabase`, `fromService`) at provision time so connection strings are never hardcoded.
- **Dedicated worker process for AI + scraping.** The worker (`type: worker`) runs BullMQ job processing in its own service with its own build step. It restarts on crash independently of the web service. On platforms without native workers you'd need a second web service burning an HTTP port it doesn't use, or bolt long-running jobs onto the request path.
- **Native cron with `schedule`.** The `type: cron` service runs `start:cron` on a cron expression (`0 6 * * 1`). No external scheduler (AWS EventBridge, GCP Cloud Scheduler) or polling loop. Render spins up the process on schedule and tears it down after exit.
- **Managed Postgres + Redis with zero config.** The `databases` and `keyValueStores` blocks provision infrastructure on the same private network. BullMQ connects over the internal Redis URL — no VPC peering, no security groups, no connection pooler to manage. The worker pulls jobs with configurable concurrency (e.g. 3 concurrent AI calls, 5 concurrent page scrapes, 20 concurrent DNS checks) and exponential backoff retries, all backed by Redis reliability.
- **Horizontal scaling is one slider.** Scale the worker to N instances and they all compete for the same BullMQ queue. Job-level concurrency limits (`CONCURRENCY_LIMITS` in `src/queue/jobs.ts`) ensure each instance respects rate limits regardless of fleet size — Claude API calls stay at 3 concurrent per instance, enrichment at 5, etc.

## License

MIT
