# Render Deployment Patterns

This guide walks through every pattern in SignalKit's `render.yaml` and explains how to adapt them for your own multi-service app. If you're evaluating Render or building your first multi-service deployment, this is the reference.

## Blueprint anatomy

Here's `render.yaml` with annotations:

```yaml
services:
  # ── Web Service ──────────────────────────────────────────────────
  - type: web                           # Serves HTTP traffic
    name: signalkit-web
    runtime: node
    plan: starter
    buildCommand: npm install && npm run build   # Full Next.js build
    startCommand: npm run start:web              # next start
    envVars:
      - key: DATABASE_URL
        fromDatabase:                   # Render injects the connection string
          name: signalkit-db            # References the database below
          property: connectionString
      - key: REDIS_URL
        fromService:                    # Render injects from another service
          name: signalkit-redis         # References the key-value store below
          type: keyvalue
          property: connectionString
      - key: ANTHROPIC_API_KEY
        sync: false                     # Must be set manually in the dashboard
      - key: ANTHROPIC_MODEL
        value: claude-sonnet-4-20250514 # Default value, overridable

  # ── Background Worker ────────────────────────────────────────────
  - type: worker                        # No HTTP port, runs continuously
    name: signalkit-worker
    runtime: node
    plan: starter
    buildCommand: npm install           # No next build — worker doesn't serve UI
    startCommand: npm run start:worker  # tsx src/services/worker/index.ts
    envVars: # ... same DATABASE_URL, REDIS_URL, ANTHROPIC_API_KEY, ANTHROPIC_MODEL

  # ── Cron Job ─────────────────────────────────────────────────────
  - type: cron                          # Starts on schedule, runs, exits
    name: signalkit-cron
    runtime: node
    plan: starter
    buildCommand: npm install           # Same as worker — no UI build
    startCommand: npm run start:cron    # tsx src/services/cron/index.ts
    schedule: "0 6 * * 1"              # Every Monday at 06:00 UTC
    envVars: # ... DATABASE_URL, REDIS_URL (no ANTHROPIC_API_KEY — cron only enqueues)

# ── Infrastructure ─────────────────────────────────────────────────
databases:
  - name: signalkit-db
    plan: starter

keyValueStores:
  - name: signalkit-redis
    plan: starter
```

One file declares two infrastructure resources and three application services. `git push` deploys all of them.

## Web + Worker + Cron: when to use which

### Web service (`type: web`)

Use for anything that serves HTTP: your frontend, API endpoints, webhooks. Render manages TLS, routing, and health checks.

SignalKit's web service runs Next.js, which serves both the React dashboard and the REST API routes. It can enqueue jobs (the "Run" button on the Sources page, the "Sync" button on company detail), but it doesn't process them.

**Anti-pattern it avoids:** Running long AI calls or scraping jobs inside API request handlers. Those would time out, block other requests, and make the web service unreliable.

### Background worker (`type: worker`)

Use for long-running or CPU/IO-intensive processing that shouldn't be tied to HTTP requests. The worker runs continuously, pulling work from a queue.

SignalKit's worker runs a BullMQ worker loop. It processes every pipeline stage: collection, enrichment (Playwright page fetches), hosting detection (DNS lookups), AI analysis (Claude API calls), trigger evaluation, action execution, and delivery. Each is a typed job with its own concurrency limit and retry policy.

**What this gives you vs. a second web service:** Render's `type: worker` is purpose-built for non-HTTP processes. No wasted HTTP port, no health-check endpoint to maintain, no confusion about which service handles requests. The worker restarts independently of the web service.

### Cron job (`type: cron`)

Use for scheduled work. Render starts the process on the cron schedule, waits for it to exit, and reports success/failure.

SignalKit's cron job is minimal: enqueue two seed jobs (`collect:yc_directory` and `evaluate_triggers:fanout`), close connections, exit. The actual work happens in the worker. This separation means the cron process runs for seconds, not minutes.

**What this gives you vs. alternatives:**

| Approach | Problem |
|----------|---------|
| `setInterval` in the web service | Runs only on one instance, no observability, restarts reset the timer |
| External scheduler (GitHub Actions, CloudWatch) hitting an HTTP endpoint | Needs authentication, endpoint maintenance, timeout management |
| Render `type: cron` | Runs the script directly, handles lifecycle, reports in the dashboard |

## Separating build steps

The three services share the same repository but have different build commands:

| Service | `buildCommand` | Why |
|---------|---------------|-----|
| Web | `npm install && npm run build` | Needs the full Next.js build (pages, API routes, static assets) |
| Worker | `npm install` | Only runs TypeScript via `tsx`. No frontend assets needed. Saves ~30s+ of build time. |
| Cron | `npm install` | Same as worker — just a script runner. |

This is a useful pattern for any monorepo deployment: **share the code, diverge at build time**. The worker skips `next build` entirely because it never serves HTTP. Less build time means faster deploys and lower build minute usage.

### Why not Docker?

Render's native Node.js runtime handles `npm install` and `start` commands directly. For SignalKit's stack (TypeScript, Next.js, BullMQ), there's no advantage to maintaining a Dockerfile. If your app needs system-level dependencies (e.g., native libraries beyond what Playwright bundles), Render also supports Docker builds — but start with native runtime and add Docker only when you need it.

## Environment variable wiring

### `fromDatabase` and `fromService`

```yaml
- key: DATABASE_URL
  fromDatabase:
    name: signalkit-db
    property: connectionString
```

Render resolves this at provision time. When the database is created, its connection string is injected into every service that references it. No copying credentials between services, no secret drift, no manual rotation when the database URL changes.

Same for Redis:

```yaml
- key: REDIS_URL
  fromService:
    name: signalkit-redis
    type: keyvalue
    property: connectionString
```

**Pattern:** Infra resources are declared once (`databases`, `keyValueStores`), referenced by name everywhere. If you rename the database, you update the `name` field in one place.

### `sync: false` for secrets

```yaml
- key: ANTHROPIC_API_KEY
  sync: false
```

This tells Render: "this variable exists but its value must be set manually in the dashboard." It won't be committed to the YAML or synced from other environments. Use `sync: false` for any secret: API keys, tokens, passwords.

### Default values with `value:`

```yaml
- key: ANTHROPIC_MODEL
  value: claude-sonnet-4-20250514
```

This provides a default that's visible in the YAML and can be overridden per-environment in the dashboard. Good for config that isn't secret but might vary between staging and production.

### Cron doesn't need AI credentials

Notice that `signalkit-cron` only has `DATABASE_URL` and `REDIS_URL` — no `ANTHROPIC_API_KEY`. The cron process only enqueues jobs; it doesn't execute AI calls. This is least-privilege: don't give a service credentials it doesn't need.

## Scaling the worker

### The BullMQ + Redis pattern

All three services share one Redis instance as the BullMQ queue backend. Jobs are enqueued by the web service (manual triggers) or cron (scheduled triggers). The worker pulls and processes them.

To scale throughput, increase the worker instance count in the Render dashboard. Each instance runs its own BullMQ `Worker` connected to the same Redis queue. BullMQ handles job locking — two workers never process the same job.

### Per-job concurrency limits

SignalKit defines concurrency limits per job type (`src/queue/jobs.ts`):

```
enrich:                    5 concurrent per worker instance
detect:hosting:           20 concurrent per worker instance
detect:website_analysis:   3 concurrent per worker instance
action:run:                3 concurrent per worker instance
evaluate_triggers:        10 concurrent per worker instance
evaluate_triggers:fanout:  1 concurrent per worker instance
deliver:                  10 concurrent per worker instance
```

These are **per-instance** limits. With 3 worker instances, you get up to 9 concurrent Claude API calls (3 per instance for `action:run` or `detect:website_analysis`), 60 concurrent DNS checks, and 15 concurrent page scrapes.

The BullMQ worker's global concurrency is set to the max of these values (20, from `detect:hosting`). Individual job handlers respect their own limits through BullMQ's concurrency configuration.

### When to scale

- **Jobs backing up in Redis:** Check the Pipeline page or `getQueueStats()` for a growing `waiting` count. Add worker instances.
- **Claude API rate limits:** If you hit Anthropic's rate limit, scaling workers won't help — reduce `action:run` and `detect:website_analysis` concurrency instead.
- **Scraping throughput:** Playwright pages use memory. If workers are OOM-killed, scale up the plan tier (more RAM per instance) rather than adding instances.

## Adapting for your own app

### Decision checklist

| If your app has... | Add this to `render.yaml` |
|--------------------|--------------------------|
| A web frontend or API | `type: web` service |
| Async work (queues, background processing) | `type: worker` service + `keyValueStores` (Redis) |
| Scheduled jobs | `type: cron` service |
| Relational data | `databases` (Postgres) |
| Caching or pub/sub | `keyValueStores` (Redis) |

### Minimal template

A starting `render.yaml` for a web + worker app with Postgres and Redis:

```yaml
services:
  - type: web
    name: my-app-web
    runtime: node
    plan: starter
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: my-app-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: my-app-redis
          type: keyvalue
          property: connectionString

  - type: worker
    name: my-app-worker
    runtime: node
    plan: starter
    buildCommand: npm install
    startCommand: npm run start:worker
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: my-app-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: my-app-redis
          type: keyvalue
          property: connectionString

databases:
  - name: my-app-db
    plan: starter

keyValueStores:
  - name: my-app-redis
    plan: starter
```

Add a `type: cron` block when you need scheduled work. Add `sync: false` env vars for secrets. Add more services as your architecture grows. The Blueprint scales with you.

### Key takeaways

1. **Declare infrastructure and services together.** One file, one deploy, no drift.
2. **Use `fromDatabase` and `fromService`** instead of copying connection strings.
3. **Separate build steps** by service type. Workers don't need frontend builds.
4. **Use `type: worker` for queue consumers.** Don't waste an HTTP port or bolt async work onto your web service.
5. **Use `type: cron` for scheduled work.** It's simpler than any external scheduler.
6. **Scale workers horizontally.** They share a Redis queue and compete for jobs safely.
