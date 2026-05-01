# Architecture Deep Dive

This document explains the key design decisions in SignalKit: why the code is structured this way, what patterns are used, and how they compose into a testable, extensible system.

## System overview

Every pipeline stage maps to a Render service and a job type:

```
                    Render Cron                  Render Worker
                   ┌──────────┐    ┌──────────────────────────────────────────────────┐
                   │          │    │                                                  │
                   │  start:  │    │  BullMQ Worker                                   │
                   │  cron    │    │                                                  │
                   │          │    │  ┌───────────┐   ┌──────────┐   ┌──────────┐     │
                   │ Enqueues │───▶│  │ Collector │──▶│ Enricher │──▶│ Detector │     │
                   │ seed     │    │  └───────────┘   └──────────┘   └──────────┘     │
                   │ jobs     │    │                                       │           │
                   │          │    │                              ┌────────▼────────┐  │
                   └──────────┘    │                              │ Trigger Eval    │  │
                                   │                              └────────┬────────┘  │
                    Render Web     │                       ┌───────────────┤           │
                   ┌──────────┐    │                       ▼               ▼           │
                   │ Next.js  │    │                  ┌────────┐    ┌──────────┐       │
                   │ Dashboard│    │                  │ Action │    │ Delivery │       │
                   │ + API    │    │                  │  (AI)  │    │          │       │
                   └──────────┘    │                  └────────┘    └──────────┘       │
                        │          └──────────────────────────────────────────────────┘
                        │                              │
                        └──────────────┬───────────────┘
                                       ▼
                             ┌──────────────────┐
                             │ Postgres + Redis  │
                             │ (Render managed)  │
                             └──────────────────┘
```

The **cron** process only enqueues two seed jobs and exits. The **worker** does all processing. The **web** service serves the dashboard and REST API, and can also enqueue jobs (e.g. manual collection runs, per-company sync).

## The plugin system

### Why factory functions instead of classes

SignalKit defines five plugin roles: **collector**, **enricher**, **detector**, **action**, and **delivery**. Each is defined with a factory function:

```typescript
// src/core/define-plugin.ts
export function defineCollector(config: Omit<CollectorDefinition, 'kind'>): CollectorDefinition {
  return { ...config, kind: 'collector' };
}
```

The pattern is the same for all five: `defineEnricher`, `defineDetector`, `defineAction`, `defineDelivery`. Each factory merges a discriminant (`kind`) into the config object and returns a typed plugin definition.

**Why not abstract base classes?** A few reasons:

1. **No inheritance chain to maintain.** Plugins are plain objects with typed fields and methods. There's no `super()` call, no method overriding, no diamond problem when combining capabilities.
2. **TypeScript narrows on `kind`.** The `PluginDefinition` union (`CollectorDefinition | DetectorDefinition | ...`) lets TypeScript narrow plugin types at compile time via the discriminant field. The registry's `switch (plugin.kind)` is exhaustive.
3. **Testability.** A plugin is just an object. In tests you can create one inline without importing a class hierarchy.

### The plugin registry

`PluginRegistry` (`src/core/plugin-registry.ts`) is five `Map<string, XDefinition>` collections behind a single `register()` method that routes by `kind`:

```typescript
register(plugin: PluginDefinition): void {
  switch (plugin.kind) {
    case 'collector':
      if (this.collectors.has(plugin.name))
        throw new Error(`Collector already registered: ${plugin.name}`);
      this.collectors.set(plugin.name, plugin);
      break;
    // ... same for detector, action, delivery, enricher
  }
}
```

Key properties:

- **Fail-fast on duplicates.** A name collision at startup is a bug, not a runtime surprise.
- **`get*` vs `require*`.** Optional lookups return `undefined`; required lookups throw with a clear error. Handlers use `require*`; UI/API use `get*`.
- **`getCatalog()`.** Returns all registered plugin names by category, so the dashboard and API can list available options without hardcoding enum arrays. (A static `catalog.ts` exists as a fallback for validation when a registry instance isn't available.)

### Open/Closed Principle in practice

Adding a new collector to SignalKit:

1. Create `src/collectors/my-source.ts` with `defineCollector({ name: 'my_source', ... })`.
2. In `src/services/bootstrap.ts`, call `registry.register(createMySourceCollector())`.
3. If the job type already exists (e.g. `collect:my_source` follows the existing pattern), add it to the `JobPayload` union and register a handler.

Adding a new detector is even simpler — detector handlers are registered dynamically:

1. Create `src/detectors/my-detector.ts` with `defineDetector({ name: 'my_detector', triggersDetectors: [...], ... })`.
2. In `bootstrap.ts`, call `registry.register(createMyDetector(aiClient))`.
3. That's it. The dynamic handler loop registers a `detect:my_detector` job handler automatically. No `JobPayload` changes needed — `detect:${string}` already matches any detector name.

No existing plugin code changes. The registry, dispatcher, and pipeline context are stable.

## Pipeline context and dependency injection

### The PipelineContext port

Every plugin method receives a `PipelineContext` (`src/core/pipeline-context.ts`):

```typescript
export interface PipelineContext {
  getCompany(companyId: string): Promise<Company>;
  upsertSignal(input: UpsertSignalInput): Promise<{ signalId: string; isNew: boolean; changed: boolean }>;
  findSignalsByCompany(companyId: string): Promise<Signal[]>;
  createActionRun(input: CreateActionRunInput): Promise<ActionRun>;
  markActionRunCompleted(id: string, output: Record<string, unknown>): Promise<void>;
  getPageText(companyId: string, pageType: string): Promise<string | null>;
  enqueue(job: JobPayload): Promise<void>;
  persistPage(input: PersistPageInput): Promise<PersistPageResult>;
  extractPageText(url: string): Promise<ExtractedPage>;
  // ... plus findSignalsByIds, markActionRunRunning, markActionRunFailed, findActionRun
}
```

This is the **port** in a ports-and-adapters architecture. Plugins call these methods; they never import `getDb()`, `QueueClient`, or `PlaywrightBrowserManager` directly.

### The composition root

`bootstrap()` in `src/services/bootstrap.ts` is the **single place** that builds the concrete `PipelineContext`:

```typescript
export function bootstrap(deps: BootstrapDeps = {}): BootstrappedSystem {
  const queue = deps.queue ?? new QueueClient();
  const aiClient = deps.aiClient ?? new AnthropicAIClient();
  const browser = deps.browser ?? new PlaywrightBrowserManager();
  const pageRepo = deps.pageRepo ?? new PageRepository();
  const signalRepo = deps.signalRepo ?? new SignalRepository();
  const actionRunRepo = deps.actionRunRepo ?? new ActionRunRepository();

  const ctx: PipelineContext = {
    getCompany: (id) => /* db query */,
    upsertSignal: (input) => signalRepo.upsert(input),
    enqueue: (job) => queue.enqueue(job),
    extractPageText: (url) => browser.extractTextAndLinks(url),
    persistPage: (input) => /* hash + upsert via pageRepo */,
    // ...
  };
  // ... register plugins, build dispatcher, return system
}
```

**Why `BootstrapDeps`?** Every concrete dependency can be overridden. Tests pass mocks:

```typescript
const system = bootstrap({
  queue: mockQueue,
  aiClient: mockAI,
  browser: mockBrowser,
  pageRepo: mockPageRepo,
});
```

This is why 502 tests run with no database, no Redis, and no Anthropic API key.

## Job architecture

### Discriminated union payloads

`JobPayload` (`src/core/types.ts`) is a TypeScript discriminated union on the `type` field:

```typescript
export type JobPayload =
  | { readonly type: 'collect:yc_directory' }
  | { readonly type: 'enrich'; readonly enricher: string; readonly companyId: string; readonly input: Record<string, unknown> }
  | { readonly type: `detect:${string}`; readonly companyId: string }
  | { readonly type: 'evaluate_triggers'; readonly companyId: string }
  | { readonly type: 'evaluate_triggers:fanout' }
  | { readonly type: 'action:run'; readonly actionRunId: string; /* ... */ }
  | { readonly type: 'deliver'; readonly actionRunId: string; /* ... */ };
```

The `detect:${string}` template literal type means any detector registered in the plugin registry automatically gets a valid job type. No need to enumerate detector names in the type — `detect:hosting`, `detect:hiring_analysis`, `detect:product_analysis`, etc. all match. When a handler narrows on `type`, TypeScript knows exactly which fields are present. If you rename a field in `JobPayload`, Vitest's typecheck catches every test file that constructs the old shape.

### Concurrency and retry policies

`src/queue/jobs.ts` defines per-job-type limits:

| Job type | Concurrency | Retry | Backoff |
|----------|-------------|-------|---------|
| `enrich` | 5 | 2 attempts | Exponential, 30s base |
| `detect:hosting` | 20 | 2 attempts | Exponential, 10s base |
| `detect:*` (AI detectors) | 3 | 1 attempt | Fixed, 60s |
| `action:run` | 3 | 1 attempt | Fixed, 60s |
| `evaluate_triggers` | 10 | 3 attempts | Exponential, 5s base |
| `evaluate_triggers:fanout` | 1 | 1 attempt | Fixed, 60s |
| `deliver` | 10 | 3 attempts | Exponential, 30s base |

The numbers reflect the resource profile of each job type. DNS checks are fast and stateless (concurrency 20). Claude API calls are rate-limited and expensive (concurrency 3). Trigger fanout should be serial to avoid duplicate evaluation races (concurrency 1). AI-powered detectors (`detect:hiring_analysis`, `detect:product_analysis`, `detect:tech_stack_analysis`) share a default concurrency of 3 and a single retry. Per-detector overrides can be added to `CONCURRENCY_LIMITS` when needed.

### The dispatcher

`JobDispatcher` (`src/queue/dispatcher.ts`) is a `Map<string, JobHandler>`:

```typescript
export class JobDispatcher {
  private readonly handlers = new Map<string, JobHandler>();

  registerHandler(jobType: string, handler: JobHandler): void {
    this.handlers.set(jobType, handler);
  }

  async dispatch(payload: JobPayload): Promise<void> {
    const handler = this.handlers.get(payload.type);
    if (!handler) throw new Error(`No handler registered for job type: ${payload.type}`);
    await handler(payload);
  }
}
```

`bootstrap()` registers one handler per job type. Detector handlers are registered dynamically — a loop over `registry.getAllDetectors()` creates a `detect:{name}` handler for each. The BullMQ worker calls `dispatcher.dispatch(job.data)` for every job it pulls. The dispatcher is intentionally simple — routing by string key with a loud error on unknown types.

## Enricher chaining

Enrichers have a mechanism for follow-up work that creates automatic crawl depth without explicit orchestration.

The homepage enricher (`src/enrichers/homepage.ts`) demonstrates the pattern:

1. Fetch the homepage with `ctx.extractPageText(url)` — returns `{ text, hrefs }`.
2. Persist the page with `ctx.persistPage(...)` — returns `{ contentChanged }`.
3. Run `discoverLinks(url, hrefs)` to find careers and login page URLs by pattern-matching the href list.
4. Return `{ contentChanged, followUp: [...] }` with `enrich` jobs for discovered pages.

Link discovery and sub-page enrichment run **regardless of whether the homepage content changed**. This decouples "should we check sub-pages" from "did the homepage change" — careers or login page content can change independently of the homepage. Each downstream enricher has its own `persistPage` call with content hashing, so if the sub-page hasn't actually changed, the enricher no-ops (reports `contentChanged: false` and no detectors fire).

The `enrich` handler in `bootstrap.ts` processes the return value:

- If `triggersDetectors` is set (homepage declares `['product_analysis', 'tech_stack_analysis']`), it enqueues detector jobs **only when `contentChanged` is true**.
- If `followUp` contains jobs, it enqueues those unconditionally.

So a single `enrich` job for a homepage can fan out into careers enrichment, login enrichment, product analysis, and tech stack analysis — all as separate BullMQ jobs with independent retries. The content-change gate for AI work happens at each enricher's own persist step, not at the parent.

The careers enricher triggers `['hiring_analysis', 'tech_stack_analysis']` and the login enricher triggers `['product_analysis', 'tech_stack_analysis']`. Each detector runs independently and can be rerun via the API.

### Detector chaining

Detectors also support `triggersDetectors`, enabling a two-tier detector architecture:

- **Extraction detectors** read raw page text and produce base signals (`hiring_activity`, `product_profile`, `tech_stack`). They're triggered by enrichers.
- **Composite detectors** read signals from other detectors (via `ctx.findSignalsByCompany()`) and produce higher-order signals. They're triggered by upstream detectors.

Detector handlers are registered dynamically at bootstrap from the plugin registry — no need to hardcode handler names for each detector. When a detector completes and has `triggersDetectors` set, the pipeline enqueues `detect:*` jobs for each downstream detector.

### Content-change gating

Expensive downstream work (detector jobs, particularly Claude API calls) is gated on `contentChanged` at each enricher's level. The page repository detects change by comparing content hashes (`sha256` of the text). If a careers page hasn't changed since the last scrape, its enricher reports `contentChanged: false` and no `detect:hiring_analysis` job fires. This prevents redundant AI calls while still checking all sub-pages on every pipeline run.

## Trigger evaluation

### Condition language

Triggers have a `conditions` object (`TriggerConditions` in `src/core/types.ts`):

```typescript
interface TriggerConditions {
  readonly match: 'all' | 'any';
  readonly conditions: readonly TriggerCondition[];
}

interface TriggerCondition {
  readonly signal_type: string;
  readonly field?: string;
  readonly operator: 'exists' | 'eq' | 'neq' | 'contains';
  readonly value?: unknown;
}
```

This is a small DSL stored as JSON in Postgres. The `match` field controls AND/OR logic. Conditions reference signal types and optionally drill into signal values with dot-path field access (`value.provider`, `value.roles`).

### Evaluation flow

`TriggerEvaluationService` (`src/core/trigger-service.ts`) orchestrates:

1. Load all active triggers and all signals for the company (in parallel).
2. For each trigger, run `evaluateTrigger(conditions, signals)` — the pure function in `trigger-evaluator.ts`.
3. If matched, compute a `signalHash` over the matched signals. This is a SHA-256 of the signal types and values, canonicalized with stable key ordering.
4. Check `trigger_runs` for an existing row with the same `(triggerId, companyId, signalHash)`. If found, skip — this trigger already fired for this signal state.
5. Return `TriggeredAction` objects for new matches.

The signal hash deduplication means a trigger fires once per distinct signal state. If a company's hosting changes from Heroku to Vercel, the hash changes and the trigger fires again.

### Separation of concerns

- `trigger-evaluator.ts` is **pure functions** — no I/O, no database, fully unit-testable.
- `trigger-service.ts` is **orchestration** — depends on repository interfaces (`ITriggerRepository`, `ITriggerRunRepository`, `ISignalSource`), all injectable.
- `bootstrap.ts` provides the **concrete implementations** (Drizzle-backed repositories).

## AI integration

### The IAIClient interface

```typescript
// src/ai/client.ts
export interface IAIClient {
  analyze<T>(prompt: string, schema: ZodSchema<T>, options?: AIAnalyzeOptions): Promise<T>;
}
```

One method: send a prompt, get back a Zod-validated typed result. The implementation (`AnthropicAIClient`) handles:

- **Schema validation with retry.** If Claude's response doesn't parse as valid JSON or fails Zod validation, it retries once with an error-annotated prompt.
- **Robust JSON extraction.** The `extractJsonObject` function tries three strategies: parse the whole response, extract from a markdown code fence, or find the first brace-balanced `{...}` substring.
- **Timeout.** A configurable `Promise.race` against the API call.

### defineAIAction

Most actions follow the same pattern: build a prompt from company + signals, call Claude, validate the output. `defineAIAction` (`src/actions/base.ts`) encapsulates this:

```typescript
export function defineAIAction(aiClient: IAIClient, actionConfig: AIActionConfig): ActionDefinition {
  return defineAction({
    name: actionConfig.name,
    schema: actionConfig.schema,
    async execute(company, signals, config, _ctx): Promise<ActionOutput> {
      const prompt = actionConfig.buildPrompt(company, signals, config);
      const result = await aiClient.analyze(prompt, actionConfig.schema, {
        maxTokens: actionConfig.maxTokens ?? 2000,
      });
      return { content: result as Record<string, unknown> };
    },
  });
}
```

Each concrete action (prospect brief, outreach draft, cost analysis, etc.) just supplies a Zod schema and a `buildPrompt` function. The AI call, validation, and retry logic are shared.

### Why Zod schemas for every AI call

Every AI output has a schema: `ProspectBriefSchema`, `CareersAnalysisSchema`, `ProductAnalysisSchema`, `TechStackSchema`, etc. This means:

- **Runtime validation.** If Claude hallucinates a field or returns the wrong shape, the error is caught immediately with a clear message.
- **Type inference.** `z.infer<typeof ProspectBriefSchema>` gives you a TypeScript type. Downstream code knows exactly what fields exist.
- **Retry feedback.** On validation failure, the schema error is included in the retry prompt, giving Claude specific guidance on what to fix.

## Testing strategy

### Interface boundaries

The codebase has four key interface boundaries:

| Interface | Production | Test mock |
|-----------|------------|-----------|
| `IAIClient` | `AnthropicAIClient` — calls Claude | `MockAIClient` — returns canned responses matched by prompt content |
| `IBrowserManager` | `PlaywrightBrowserManager` — headless Chrome | `MockBrowserManager` — returns pre-seeded text and hrefs per URL |
| `IPageRepository` | `PageRepository` — Drizzle + Postgres | `MockPageRepository` — in-memory Map with upsert semantics |
| `IQueueClient` | `QueueClient` — BullMQ + Redis | Test doubles that capture enqueued payloads |

Plus the repository interfaces in `trigger-service.ts` (`ITriggerRepository`, `ITriggerRunRepository`, `ISignalSource`) — also backed by Drizzle in production and simple in-memory stores in tests.

### Vitest typecheck

`vitest.config.ts` enables `typecheck`:

```typescript
typecheck: {
  enabled: true,
  tsconfig: './tsconfig.json',
  include: ['**/*.test.ts', '**/*.test.tsx'],
},
```

This means `npm test` type-checks all test files against the real `tsconfig.json`. If someone renames a field in `JobPayload`, every test that constructs a payload with the old field name fails — at type-check time, not at runtime. This caught real drift during development when payload shapes evolved.

### No infrastructure required

All 502 tests run with `npm test` — no Postgres, no Redis, no Anthropic API key. Tests exercise the full pipeline logic (collection, enrichment, detection, trigger evaluation, action execution) using injected mocks. The only thing not tested at the unit level is the actual BullMQ worker loop and Playwright browser, which are thin wrappers around the tested dispatch and extraction logic.
