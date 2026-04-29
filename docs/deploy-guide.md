# Deploy Guide: Zero to AI Output in Five Minutes

This guide walks you through deploying SignalKit on Render and seeing your first AI-generated prospect brief. Every step ends with something visible so you know it worked.

## What you're about to deploy

One click provisions five managed services on Render:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          Render Blueprint (render.yaml)                      │
│                                                                              │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐               │
│  │  Web Service  │  │ Background Worker │  │    Cron Job       │              │
│  │  (Dashboard)  │  │ (AI + scraping)   │  │ (weekly trigger)  │              │
│  └──────┬───────┘  └────────┬─────────┘  └────────┬─────────┘               │
│         │                   │                      │                         │
│         └───────────┬───────┴──────────────────────┘                         │
│                     │                                                        │
│         ┌───────────┴───────────┐                                            │
│         │                       │                                            │
│    ┌────┴─────┐          ┌──────┴──────┐                                     │
│    │ Postgres │          │    Redis    │                                      │
│    │  (data)  │          │   (queue)   │                                      │
│    └──────────┘          └─────────────┘                                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

The end state: a dashboard showing YC-backed startups with detected hosting signals, scraped page content, and AI-generated prospect briefs — all running on infrastructure Render manages for you.

## Prerequisites

You need two things:

1. A [Render account](https://render.com) (free tier works for trying this out).
2. An [Anthropic API key](https://console.anthropic.com) for Claude.

## Step 1: Fork and connect

1. Fork this repository on GitHub.
2. In the Render Dashboard, click **New** then **Blueprint**.
3. Connect your GitHub account if you haven't already, then select your fork.
4. Render reads `render.yaml` and shows a preview of all five services it will create.

**Checkpoint:** You should see five services listed in the Blueprint preview — `signalkit-web`, `signalkit-worker`, `signalkit-cron`, `signalkit-db`, and `signalkit-redis`.

## Step 2: Set your API key

1. In the Blueprint setup, find the `ANTHROPIC_API_KEY` field (marked as a sync secret).
2. Paste your Anthropic API key.
3. Click **Apply** to start provisioning.

Render creates the Postgres database and Redis instance first, then builds and deploys the web, worker, and cron services. The `DATABASE_URL` and `REDIS_URL` are injected automatically — you never touch a connection string.

**Checkpoint:** All five services show **Deploy succeeded** (green) in the Render dashboard. This typically takes 2-4 minutes.

## Step 3: Trigger your first collection

1. Open the web service URL (Render shows it on the `signalkit-web` service page).
2. Navigate to **Sources** in the sidebar.
3. You should see "yc_directory" listed as a data source.
4. Click **Run** to start a collection.

Behind the scenes: the web service enqueues a `collect:yc_directory` job into Redis. The worker picks it up, fetches the YC company directory, filters for active startups with 1-50 employees, and upserts them into Postgres. For each company with a website, it enqueues enrichment and hosting detection jobs.

**Checkpoint:** Switch to the **Companies** page. Within a minute or two you should see companies appearing — names, domains, and metadata pulled from the YC directory.

## Step 4: Watch enrichment and detection

The worker is now processing a cascade of jobs:

1. **Enrichment** — Playwright fetches each company's homepage, discovers careers and login page links, and scrapes those too.
2. **Hosting detection** — DNS lookups and HTTP header analysis identify hosting providers (Heroku, Vercel, Netlify, Render, etc.).
3. **AI analysis** — Claude reads the scraped page content and extracts structured signals: hiring patterns from careers pages, product profiles from homepages, tech stack indicators.

Click into any company to see its detail page. As jobs complete, signals appear: `hosting_detected`, `careers_page`, `product_profile`, `tech_stack`.

**Checkpoint:** You should see at least `hosting_detected` signals on several companies within a few minutes. AI-powered signals (`careers_page`, `product_profile`) follow as Claude processes the page content.

## Step 5: See AI-generated output

1. Navigate to **Triggers** and create a new trigger:
   - **Name:** "Prospect brief for all companies"
   - **Condition:** signal type `hosting_detected` exists
   - **Action:** `prospect_brief`
   - **Delivery:** `dashboard`
2. The next time trigger evaluation runs (automatically after detection), matching companies will get AI-generated prospect briefs.
3. Navigate to **Actions** to browse the output.

Alternatively, trigger evaluation manually: go to any company detail page and click **Sync** — this re-runs the pipeline for that company, including trigger evaluation.

**Checkpoint:** On the Actions page, you should see prospect briefs appearing — structured intelligence reports with a summary, infrastructure assessment, signals summary, and approach angle. These were written by Claude, triggered by detected signals, for a real YC startup, on infrastructure you deployed minutes ago.

## Step 6: Set up the weekly schedule

The cron service is already configured. Every Monday at 06:00 UTC, Render starts the cron process, which:

1. Enqueues a `collect:yc_directory` job to refresh the company list.
2. Enqueues an `evaluate_triggers:fanout` job to re-evaluate all trigger rules.

The worker picks up these jobs and runs the full pipeline again. New companies get added, existing companies get re-enriched if their pages changed, and triggers fire for any new signal matches.

You don't need to do anything here — it's already wired. Check the **Pipeline** page for job statistics and run history.

**Checkpoint:** The Pipeline page shows job counts, success rates, and recent activity.

## What just happened

Let's trace what the five Render services did during steps 3-5:

| Service | What it did |
|---------|-------------|
| **Web** (`signalkit-web`) | Served the dashboard you were clicking through. Handled the "Run" button by enqueuing a job via the REST API. |
| **Worker** (`signalkit-worker`) | Pulled jobs from the Redis queue. Ran the YC collector, Playwright scrapers, DNS detector, Claude API calls, trigger evaluation, and action execution — all as typed BullMQ jobs with retries and concurrency limits. |
| **Cron** (`signalkit-cron`) | Waiting for Monday. When it fires, it enqueues two seed jobs and exits. The worker does the rest. |
| **Postgres** (`signalkit-db`) | Stored companies, scraped pages, detected signals, trigger definitions, and AI-generated action outputs. Full audit trail from collection to delivery. |
| **Redis** (`signalkit-redis`) | Backed the BullMQ job queue. Every pipeline step was a job: collection, enrichment, detection, trigger evaluation, action execution, delivery. Jobs retried on failure with exponential backoff. |

You got a multi-service AI pipeline — web dashboard, background job processing, scheduled automation, managed database, managed queue — deployed from a single YAML file with one secret to configure.

## Next steps

- **Understand the architecture:** [Architecture deep dive](architecture.md) explains the plugin system, dependency injection, job architecture, and testing strategy.
- **Learn the Render patterns:** [Render deployment patterns](render-patterns.md) walks through `render.yaml` line by line and shows how to adapt these patterns for your own multi-service app.
- **Add your own data source:** See the [Extending for Your Use Case](../README.md#extending-for-your-use-case) section in the README.
- **Configure delivery channels:** Slack, email, and webhook stubs are ready at `src/deliveries/`. Add your credentials and configure deliveries on triggers.

## Troubleshooting

**Services show "Deploy failed":** Check the build logs in Render. The most common issue is a missing `ANTHROPIC_API_KEY`. The worker and web services both need it.

**No companies appearing after "Run":** Check the worker service logs. If the worker isn't running, jobs sit in the Redis queue. Verify the worker shows "listening on queue" in its logs.

**Signals not appearing:** AI-powered signals require successful page scraping first. Check the worker logs for Playwright errors. Some sites block headless browsers — this is expected for a subset of companies.

**Actions page is empty:** Actions only run when triggers match. Make sure you've created at least one trigger with a condition that matches your existing signals.
