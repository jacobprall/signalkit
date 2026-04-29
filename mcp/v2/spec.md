# Render MCP Server v2 — Spec

A from-first-principles rebuild of `v0/render-mcp-server` (Go) on **TypeScript +
Bun**, plus two new capabilities:

1. **Hybrid docs search** (FTS5 + vector) over Render's documentation, baked
   into the image.
2. **Code Mode `execute` tool**, modeled on
   [Cloudflare's Code Mode](https://blog.cloudflare.com/code-mode/), so the
   agent writes TypeScript that calls a typed `render` binding instead of
   chaining ~25 raw tool calls.

The server is intended to be **deployed on Render itself** as a multi-tenant
HTTP MCP server, scaling on connections.

---

## 1. Goals & non-goals

### Goals
- Parity with v0's tool surface (~25 tools across 7 domains: workspaces,
  services, deploys, postgres, key value, logs, metrics).
- A new `search_docs` MCP tool backed by SQLite + sqlite-vector + sqlite-ai
  (GGUF nomic-embed-text-v1.5, Q4_K_M, 512d via Matryoshka truncation).
- A new `execute` MCP tool that runs agent-authored TypeScript in a sandbox
  with a typed `render` binding to all v0 tools.
- HTTP Streamable transport, per-session workspace state in Redis (Render Key
  Value) when available, in-memory fallback otherwise.
- Single Docker image. No npm distribution.

### Non-goals (v2)
- Stdio transport. (Single hosted target.)
- Nightly docs refresh pipeline. Docs are baked at image build; refresh =
  rebuild.
- CI eval gating.
- OAuth. v0's unused refresh-token slot stays unused.
- Differential / per-row docs updates. Full rebuild.

---

## 2. Tool surface

Three categories, all registered on the same MCP server:

### 2.1 v0 parity tools (~25)
All names, parameters, descriptions, annotations, and response shapes carry
over verbatim from v0 (see `history.md` §3). Specifically preserve:
- `update_environment_variables` is the **only** tool with
  `DestructiveHint: true`.
- `update_web_service` / `update_static_site` / `update_cron_job` are stubs
  returning a dashboard URL with `ReadOnlyHint: true`.
- `select_workspace`'s description warns the model not to call it without
  user confirmation.
- `list_workspaces` auto-selects when exactly one workspace is returned.
- Empty-result text strings (`"No Postgres instances found"`, etc.) are
  literal.

### 2.2 `search_docs` (new)
```ts
search_docs({
  query?: string,    // either query OR url required
  url?:   string,    // when set, returns the full doc at that URL
  limit?: number,    // default 5; ignored when url is set
})
```
- Two modes:
  - **query mode**: hybrid FTS5 + vector search, RRF fusion (k=60), top-k
    chunks. Each result = `{ title, section, url, content, score }`.
  - **url mode**: returns **all** chunks for that URL as an ordered list
    (by `chunk_index`). Strict match — returns 404-style "not indexed" if
    the URL isn't in the DB. The agent is expected to read URLs out of
    earlier query-mode results.
- No `section` filter. No fuzzy URL resolution. No staleness footer.
- Annotations: `{ readOnlyHint: true, openWorldHint: false }`.
- **Available before workspace selection** — does not depend on session.

### 2.3 `execute` (new — Code Mode)
```ts
execute({
  code: string,    // TypeScript source
})
```
- Runs `code` in a sandbox with one global, `render`, typed against the v0
  parity tools. Output is captured via `console.log`/`console.error` and
  returned as the tool result.
- `render.docs.search(...)` is **not** exposed inside the sandbox; docs
  search remains a top-level MCP tool only.
- The Render API bearer token is held by the parent process; the sandbox
  cannot read it.
- See §5 for the sandbox design.

---

## 3. Runtime, transport, process model

- **Runtime**: Bun ≥ 1.2 (for stable `bun:sqlite` extension loading).
- **Transport**: HTTP Streamable only, on `:10000`, mounted at `/mcp`.
  Health check at `/health`. `GET /mcp` and `DELETE /mcp` return 405.
- **Auth gate**: a single middleware on `/mcp` validates the
  `Authorization: Bearer <token>` header against `RENDER_API_KEY` (or
  `MCP_API_TOKEN` if set). Health check is unauthenticated. Same gate
  applies to `search_docs` — i.e. docs search is **gated by the bearer**;
  unauthenticated browsing is out of scope.
- **HTTP framework**: Bun's native `Bun.serve`. Express was v1's choice;
  we drop it for v2 since Bun's serve is enough and removes a transitive
  dep tree.
- **MCP SDK**: `@modelcontextprotocol/sdk` (TypeScript), Streamable HTTP
  transport.

---

## 4. Session & auth

Mirrors v0's `Session` / `Store` interfaces from `history.md` §4. Workspace
ID is the only state kept across requests.

```ts
interface Store {
  get(sessionId: string): Promise<Session>;
}
interface Session {
  getWorkspace(): Promise<string>; // throws ErrNoWorkspace when unset
  setWorkspace(id: string): Promise<void>;
}
```

### 4.1 Backends
- **`REDIS_URL` set** → Redis hash, key `session:<mcp-session-id>`, field
  `workspaceID`. No TTL. Concurrency-safe by Redis semantics.
- **`REDIS_URL` unset** → in-process `Map<string, { workspaceID?: string }>`.
  Single-process safe (Bun is single-threaded per worker; no extra locking
  needed). On scale-out you must set `REDIS_URL`.

No SQLite-backed session store. `docs.db` stays read-only and is never
written at runtime.

### 4.2 Token plumbing
- The bearer arrives on every `/mcp` request via `Authorization`.
- A `RequestContext` object (typed, not a `Map<symbol, unknown>` like v0's
  bag) is constructed per request and threaded through tool handlers.
- The Render API client (auto-generated from OpenAPI; see §10) reads the
  bearer from `RequestContext` via a single middleware that injects:
  - `Authorization: Bearer <token>`
  - `User-Agent: render-mcp-server/<version> (<os>)` plus any client UA
  - `X-Forwarded-For` (built per v0 §5; dedupe consecutive entries)
- `Bearer ` prefix tolerance from v0 (MCP Inspector quirk) is **kept**.

### 4.3 Error strings (preserve verbatim)
- `ErrNoWorkspace` text:
  > "no workspace set. Prompt the user to select a workspace. Do NOT try
  > to select a workspace for them, as it may be destructive"
- `ErrLogin` text:
  > "not authenticated; either set RENDER_API_KEY or ask your MCP host to
  > authenticate"
- HTTP error mapping: `401 → ErrUnauthorized`, `403 → ErrForbidden`,
  otherwise `received response code <N>: <message>`.

---

## 5. Code Mode — `execute` sandbox

Modeled on Cloudflare Code Mode but adapted to Bun. The agent is presented
**only** with the v0 parity tools as direct MCP tools *and* with `execute`;
it can choose either path.

### 5.1 Sandbox abstraction

```ts
interface Sandbox {
  run(opts: {
    code: string;
    bindings: BindingHost;        // RPC-callable from inside the sandbox
    timeoutMs: number;            // default 30_000
    memoryMb?: number;            // best-effort
  }): Promise<{
    stdout: string;
    stderr: string;
    error?: { name: string; message: string; stack?: string };
    durationMs: number;
  }>;
}
```

Two implementations:

- **`BunSubprocessSandbox`** (default for v2): see §5.2.
- **`RenderHostedSandbox`** (future): swap in a Render-hosted isolate
  service. Same interface; same `BindingHost` semantics. Not implemented
  in v2.

Tool code never depends on the concrete sandbox.

### 5.2 `BunSubprocessSandbox`

- `Bun.spawn` a child process running `dist/sandbox-harness.js` with:
  - `env: {}` — **no** environment inheritance (no `RENDER_API_KEY`).
  - `cwd`: a fresh empty `tmpdir` created with `mkdtemp`, deleted on exit.
  - `stdio: ['pipe', 'pipe', 'pipe']`.
  - `timeout` enforced via a `setTimeout` that calls `child.kill('SIGKILL')`.
- The harness reads a JSON message from stdin: `{ code: string }`.
- Inside the harness, before evaluating user code:
  - Delete / shadow `fetch`, `WebSocket`, `Bun.connect`, `Bun.spawn`,
    `Bun.write`, `process.env`, `process.exit`, dynamic `import()`,
    `require`, `Worker`, file system globals.
  - Install a `render` proxy whose methods JSON-RPC over a dedicated stdio
    channel back to the parent. Each method is named after a v0 parity
    tool (`render.list_services`, `render.create_postgres`, etc.).
- User code is wrapped:
  ```ts
  (async () => {
    // user code
  })().catch((e) => { console.error(e?.stack ?? String(e)); });
  ```
- Stdout / stderr from `console.log` / `console.error` are captured and
  returned to the agent verbatim (truncated to a token-budget cap).

### 5.3 Binding host (parent side)

- Listens on the dedicated stdio channel for RPC calls.
- For each call:
  1. Look up the tool by name in the same registry the MCP layer uses.
  2. Apply the same Zod validation as the MCP path.
  3. Run the same handler against the same `RequestContext` (so the
     bearer, workspace ID, XFF, UA all match the outer request).
  4. Send the result (or typed error) back over the channel.
- Result: the bearer is never visible to the sandbox; auth/workspace are
  enforced identically whether the agent calls a tool directly or via
  `execute`.

### 5.4 Typed binding surface
The agent needs to know what `render.*` exposes. Options:

- **In v2**: ship a static `render.d.ts` bundled into `execute`'s tool
  description (or surfaced as an MCP resource). Keep it auto-generated from
  the same Zod schemas the MCP tools use.

A future iteration can return the `.d.ts` dynamically from a separate
`get_typings` tool, à la Cloudflare's framework.

### 5.5 Annotations
`execute` is `{ readOnlyHint: false, destructiveHint: true, openWorldHint: true }` —
because the agent can compose anything, including destructive actions
(`update_environment_variables`).

---

## 6. Docs subsystem

Carries forward v1's design with upgrades.

### 6.1 Source
- Primary: `https://render.com/docs/llms.txt` (link index) and
  `https://render.com/docs/llms-full.txt` (full markdown, ~20k lines).
- Both URLs are configurable via `LLMS_TXT_URL` / `LLMS_FULL_TXT_URL`.

### 6.2 Chunking
Replaces v1's hand-rolled splitter with **`@langchain/textsplitters`**:
1. `MarkdownHeaderTextSplitter` — split on `#`, `##`, `###` to preserve
   page → section → subsection structure as metadata.
2. `RecursiveCharacterTextSplitter` per leaf section: target 800 tokens,
   100-token overlap (sliding window).
3. **Code-fence guard**: never split inside a fenced ```` ``` ```` block.
   Fences nest as a single atomic unit.
4. Drop chunks <40 chars (boilerplate / empty subsections).

Each chunk: `{ url, title, section, chunk_index, content, content_hash }`.
URL is resolved from llms.txt's link index; if a chunk's parent page isn't
in the index, the chunk is dropped.

### 6.3 Embeddings
- Model: `nomic-embed-text-v1.5.Q4_K_M.gguf`, loaded via sqlite-ai
  (`llm_model_load` + `llm_context_create_embedding`).
- Use the model's **asymmetric prefixes**:
  - Documents: `search_document: <chunk content>`
  - Queries:   `search_query: <user query>`
- **Matryoshka truncation to 512d** before storage. Done by slicing the
  raw 768d float32 buffer to its first 2048 bytes (512 × 4) and L2-
  renormalizing.
- Embed **the full chunk content** (not v1's `title + section + first 500
  chars`).
- Quantize stored vectors to UINT8 via `vector_quantize` for memory speed.

### 6.4 Hybrid search (RRF)
Same RRF (k=60) as v1, applied across:
- FTS5 over `(title, section, url, content, search_text)` with porter +
  unicode61 tokenizer; combine an AND-mode and OR-mode FTS query before
  fusing with vectors (v1 already does this — keep).
- Vector search via `vector_full_scan('docs', 'embedding', :q, :k)` with
  cosine distance.

### 6.5 Schema (`docs.db`)

```sql
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- keys: schema_version (int), model_id, model_dim, last_synced (ISO8601),
--       source_hash (sha256 of llms-full.txt at build time),
--       chunks_count, has_embeddings (bool)

CREATE TABLE docs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  url          TEXT NOT NULL,
  title        TEXT NOT NULL,
  section      TEXT NOT NULL,        -- '' for page intro
  chunk_index  INTEGER NOT NULL,     -- 0-based, ordered within URL
  content      TEXT NOT NULL,
  content_hash TEXT NOT NULL,        -- sha256 of content (per-row hash)
  embedding    BLOB                  -- 512 × float32 (or quantized UINT8)
);
CREATE INDEX docs_url_idx ON docs(url, chunk_index);

CREATE VIRTUAL TABLE docs_fts USING fts5(
  title, section, url, content, search_text,
  content='', contentless_delete=1, tokenize='porter unicode61'
);
```

`vector_init('docs', 'embedding', 'dimension=512,type=FLOAT32,distance=COSINE')`
is run at open-time after extensions are loaded.

### 6.6 Versioning gate
On open, the server reads `meta`:
- If `schema_version` ≠ the binary's compiled-in version → **refuse to
  start** with a clear log line: "schema mismatch: db=<x>, binary=<y>; set
  FORCE_REINDEX=1 to rebuild".
- If `model_id` ≠ the binary's compiled-in model → **refuse**, same
  shape.
- Same for `model_dim`.

### 6.7 Build pipeline (one-shot)
- Dockerfile stage `prebuild` runs `dist/prebuild-db.js` which:
  1. Downloads llms.txt + llms-full.txt.
  2. Records `source_hash`.
  3. Chunks via §6.2.
  4. Embeds via sqlite-ai (CPU, `gpu_layers=0`).
  5. Writes `docs.db` to `/app/seed/docs.db` plus `meta` rows.
- The `production` stage copies `/app/seed/docs.db` into the image.
- At runtime the server copies seed → `DB_PATH` on first boot if no DB
  exists. **No** automatic refresh thereafter.

### 6.8 Runtime fallback
If the seed copy is missing **and** the env allows network (it does in
production), the runtime indexer (`fetchAndParseDocs` + `ingestDocs`) runs
once on startup and persists into `DB_PATH`. This keeps the dev loop
working without a full Docker build. It is **not** a refresh strategy.

---

## 7. Configuration

| Env var | Required | Default | Purpose |
|---|---|---|---|
| `RENDER_API_KEY` | Yes (hosted auth) | — | MCP bearer + outbound API calls |
| `MCP_API_TOKEN` | No | falls back to `RENDER_API_KEY` | Override MCP-side bearer separately |
| `RENDER_HOST` | No | `api.render.com` | Override base API host |
| `REDIS_URL` | No | unset | Switch session store to Redis |
| `RENDER_WORKSPACE` | No | unset | Seed workspace ID at startup |
| `OPENAI_VERIFICATION_TOKEN` | No | unset | When set, exposes `/.well-known/openai-apps-challenge` |
| `EMBEDDING_MODEL_PATH` | No | `./vendor/models/nomic-embed-text-v1.5.Q4_K_M.gguf` | GGUF path |
| `DB_PATH` | No | `/data/docs.db` | Runtime docs DB path |
| `SEED_DB_PATH` | No | `/app/seed/docs.db` | Baked seed path |
| `LLMS_TXT_URL` | No | `https://render.com/docs/llms.txt` | Docs source |
| `LLMS_FULL_TXT_URL` | No | `https://render.com/docs/llms-full.txt` | Docs source |
| `FORCE_REINDEX` | No | unset | Wipe + rebuild on start |
| `PORT` | No | `10000` | HTTP listen port |
| `READ_ONLY` | No | unset | Reject mutation tools — analogous to v1 |

CLI flags: `--version`. (No `--transport` flag — HTTP only.)

---

## 8. Build & distribution

- Single multi-stage **Docker image** (no npm artifact). Stages:
  `base → deps → vendor → build → prebuild → production`.
- `vendor` stage runs `scripts/setup-vendor.ts` (existing in v1, port to
  Bun) which downloads:
  - `sqlite-vector` shared lib (from `sqliteai/sqlite-vector` releases).
  - `sqlite-ai` shared lib (from `sqliteai/sqlite-ai` releases).
  - `nomic-embed-text-v1.5.Q4_K_M.gguf` (from `nomic-ai/...-GGUF`).
- `prebuild` stage runs `dist/prebuild-db.js` to bake `docs.db` into
  `/app/seed`.
- `production` stage: `oven/bun:1.2-slim` + ca-certificates + the
  vendored libs + the prebaked DB + compiled JS.
- A `render.yaml` Blueprint deploys: a `web` service (this image) plus a
  `keyvalue` named `mcp-kv` whose `connectionString` is wired in as
  `REDIS_URL`. `OPENAI_VERIFICATION_TOKEN` set manually
  (`sync: false`).

---

## 9. Security model

- **Bearer never on disk.** Held only in `RequestContext`. Never persisted
  to Redis or written to logs.
- **Sandbox isolation** (Bun subprocess):
  - No env inheritance → bearer absent from the child's address space.
  - Globals `fetch`, `WebSocket`, `Bun.connect`, `Bun.spawn`,
    `Bun.write`, dynamic `import`, `require`, `Worker` are removed before
    user code runs.
  - Network is reachable only via the parent-mediated `render` proxy.
  - Hard SIGKILL on timeout. Empty `cwd`. No FS write outside `cwd`.
- **Workspace tenancy**:
  - List repos inject the active workspace ID; no tool argument lets the
    agent break out.
  - Create repos call `WorkspaceMatches(ctx, ownerId)` belt-and-
    suspenders.
  - `update_environment_variables` does an explicit `GetService` first to
    force 403/404 on cross-workspace IDs.
- **`query_render_postgres`**: fresh connection per call, `BEGIN READ
  ONLY` transaction, always-rollback `defer`, no pooling. Connection
  string fetched via the API at call time.
- **HTTP**: same auth gate covers both `search_docs` and `execute`; CORS
  not configured (Render edge handles it).

---

## 10. Module layout

```
v2/
├── package.json                  # Bun + tsconfig
├── Dockerfile
├── render.yaml
├── scripts/
│   ├── setup-vendor.ts           # ports v1 verbatim
│   └── prebuild-db.ts            # build-time docs indexer
├── src/
│   ├── server.ts                 # entrypoint: bootstrap HTTP + MCP
│   ├── http.ts                   # Bun.serve + auth middleware + /mcp + /health
│   ├── mcp/
│   │   ├── registry.ts           # tool registry (Zod schemas + handlers)
│   │   ├── annotations.ts        # ReadOnly/Destructive/Idempotent/OpenWorld
│   │   └── tools/
│   │       ├── workspaces.ts     # list/select/get
│   │       ├── services.ts       # list/get/create/update_*/update_env_vars
│   │       ├── deploys.ts        # list/get
│   │       ├── postgres.ts       # list/get/create/query_render_postgres
│   │       ├── keyvalue.ts       # list/get/create
│   │       ├── logs.ts           # list_logs / list_log_label_values
│   │       ├── metrics.ts        # get_metrics
│   │       ├── docs.ts           # search_docs (query | url modes)
│   │       └── execute.ts        # Code Mode entrypoint
│   ├── client/
│   │   ├── api.ts                # generated from OpenAPI (openapi-typescript + openapi-fetch)
│   │   └── middleware.ts         # auth/UA/XFF injection from RequestContext
│   ├── session/
│   │   ├── store.ts              # Store interface
│   │   ├── memory.ts             # in-process Map backend
│   │   ├── redis.ts              # ioredis-backed
│   │   └── errors.ts             # ErrNoWorkspace / ErrLogin
│   ├── ctx/
│   │   └── request-context.ts    # typed bearer + UA + XFF + workspace
│   ├── validate/
│   │   └── params.ts             # ports v0's validate.* helpers; preserve error strings
│   ├── docs/
│   │   ├── db.ts                 # openDatabase, schema, hybrid search, RRF
│   │   ├── chunker.ts            # LangChain splitter wiring + code-fence guard
│   │   ├── ingest.ts             # fetch, chunk, embed, write
│   │   └── meta.ts               # schema/model versioning gate
│   ├── sandbox/
│   │   ├── sandbox.ts            # Sandbox interface
│   │   ├── bun-subprocess.ts     # default impl
│   │   ├── harness.ts            # runs inside child; shadowing + RPC client
│   │   ├── bindings.ts           # parent-side RPC dispatcher → tool registry
│   │   └── typings.ts            # generates render.d.ts from Zod schemas
│   └── version.ts                # semver, schema_version, model_id constants
└── tests/
    ├── session.test.ts
    ├── docs-search.test.ts
    ├── chunker.test.ts
    └── sandbox.test.ts            # harness shadowing, bearer absence, RPC roundtrip
```

---

## 11. Testing

Pragmatic only — no CI gating in v2:
- Vitest (or Bun's built-in test runner).
- Session tests: in-memory + Redis (local container OK).
- Docs search: synthetic chunks → assert recall on a small (<10) hand-
  written eval set. Skip the formal eval gate.
- Sandbox: assert that `fetch`, `Bun.connect`, `process.env`,
  `RENDER_API_KEY` are all `undefined` / throw inside the harness; assert
  that `render.list_services()` round-trips through the binding to a
  stub registry and back.

---

## 12. Deferred / open

- Nightly docs refresh + image rotation. Out of scope; refresh = rebuild.
- A `RenderHostedSandbox` implementation backed by a real isolate
  service.
- Per-row hash → incremental docs reindex.
- Returning `render.d.ts` from a dedicated `get_typings` tool.
- Concurrency / rate limiting at the `/mcp` edge.
- CI eval gate.

---

## 13. Reference

- v0 deep-dive: `history.md` (parity surface, error strings, security
  invariants).
- v1 prototype: `v1/` (sqlite-ai + sqlite-vector + GGUF + hybrid search +
  Docker image with prebuilt DB; reuse `scripts/setup-vendor.ts`,
  `src/db.ts`, `src/docs.ts`, `src/prebuild-db.ts` as starting points,
  porting Node → Bun and applying §6.2–6.4 upgrades).
- Cloudflare Code Mode: <https://blog.cloudflare.com/code-mode/>.
