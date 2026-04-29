# Render MCP Server — Project History & TypeScript Rewrite Reference

This document is a working reference for rebuilding `v0/render-mcp-server` (Go) as
v2 in TypeScript on Bun.js. The v2 goals (per `v2/spec.md`):

1. **Parity** with the existing v0 server.
2. Add a docs search tool backed by SQLite + sqlite-vector (vector search), shipped
   with a pre-loaded database, so the agent can understand how to use Render.
3. Decide ingestion/indexing/maintenance strategy for keeping the docs DB current.

The notes below capture everything from the v0 deep-dive that is directly relevant
to the rewrite. Naming, semantics, error strings, tool annotations, and security
properties should be preserved unless explicitly changed.

---

## 1. What the v0 server is

A Go binary (`github.com/render-oss/render-mcp-server`) that speaks the
[Model Context Protocol](https://modelcontextprotocol.io) and exposes tools to
read and manage Render resources via the Render REST API
(`https://api.render.com/v1`).

Public docs: `https://render.com/docs/mcp-server`. Source: `render-oss/render-mcp-server`.

Two distribution modes, both supported by the same binary:

- **stdio** (default) — local desktop MCP host (Cursor, Claude Desktop, etc).
  Token from `RENDER_API_KEY`. Workspace selection persists in
  `~/.render/mcp-server.yaml`.
- **HTTP streamable** — hosted on Render itself. Bearer token comes from each
  request's `Authorization` header. Workspace selection per-MCP-session, stored
  in Redis (or in-memory). Listens on `:10000`, mounts MCP at `/mcp`. Also
  serves `/.well-known/openai-apps-challenge` when `OPENAI_VERIFICATION_TOKEN`
  is set so it can register as an OpenAI App.

Entry: `main.go` parses `--version`/`-v` and `--transport`/`-t` (`stdio|http`,
default `stdio`), then calls `cmd.Serve`. `cmd/server.go` builds one shared
`*client.ClientWithResponses` and registers all tool sets.

---

## 2. Repo layout (v0)

```
v0/render-mcp-server/
├── main.go, cmd/server.go        # CLI + bootstrap
├── Dockerfile                    # multi-stage; final = gcr.io/distroless/base-debian12
├── render.yaml                   # Blueprint deploying this server (web + keyvalue)
├── .goreleaser.yml, workflows/   # GoReleaser-driven release pipeline
├── pkg/
│   ├── authn/                    # Bearer token plumbing (header + env)
│   ├── cfg/                      # Version, host, API key, user-agent
│   ├── client/                   # OpenAPI-generated REST client (+ subdirs per resource)
│   ├── config/                   # On-disk YAML config (~/.render/mcp-server.yaml)
│   ├── deploy/                   # Tools + repo: list/get deploys
│   ├── environment/              # Repo only (not exposed as tools)
│   ├── fakes/                    # counterfeiter-generated test fakes
│   ├── httpcontext/              # User-Agent + X-Forwarded-For capture
│   ├── keyvalue/                 # Tools + repo: KV (Redis-compatible) instances
│   ├── logs/                     # Tools + repo: logs + label values
│   ├── mcpserver/                # Enum/value helpers (RegionEnumValues, etc.)
│   ├── metrics/                  # Tools + repo: per-resource metrics
│   ├── multicontext/             # MultiHTTPContextFunc / MultiStdioContextFunc
│   ├── owner/                    # Tools + repo: workspaces
│   ├── pointers/                 # `pointers.From[T]` helper for *T optional fields
│   ├── postgres/                 # Tools + repo: Postgres + read-only SQL
│   ├── service/                  # Tools + repo: web/static/cron + env vars
│   ├── session/                  # Session abstraction + 3 backends
│   └── validate/                 # Generic param validators + plan validators
└── README.md, SECURITY.md, LICENSE
```

The TS port should preserve this domain decomposition (`session`, `authn`, per-resource
tool packages) even if the directory layout changes.

---

## 3. Tools to implement (parity surface)

All names/parameter shapes must match v0 exactly for drop-in replacement. ~25 tools
in 7 domains.

### Workspaces (`owner`)
- `list_workspaces` — no params. **Important:** if exactly one workspace is
  returned, auto-select it. Result text is a prose hint + JSON.
- `select_workspace { ownerID: string }` — description must explicitly tell the
  LLM not to use this without a user confirmation; "Having the wrong workspace
  selected can lead to destructive actions on unintended resources."
- `get_selected_workspace` — no params.

### Services (`service`)
- `list_services { includePreviews?: bool }`
- `get_service { serviceId: string }`
- `create_web_service` — params: `name`, `runtime` (enum: node|python|go|rust|ruby|elixir|docker),
  `buildCommand`, `startCommand` (all required); optional `repo`, `branch`, `plan`,
  `autoDeploy` (yes|no, default yes), `region` (default oregon), `envVars`.
- `create_static_site` — params: `name`, `buildCommand` (required); optional
  `repo`, `branch`, `autoDeploy`, `publishPath` (default "public"), `envVars`.
- `create_cron_job` — params: `name`, `schedule` (cron), `runtime`, `buildCommand`,
  `startCommand` (required); optional `repo`, `branch`, `plan` (default starter),
  `autoDeploy`, `region`, `envVars`.
- `update_web_service`, `update_static_site`, `update_cron_job` — **deliberate
  stubs**. Required `serviceId`; handler returns a text result that says "not
  supported, use the dashboard at <url>". Keep this exact pattern.
- `update_environment_variables { serviceId, replace?: bool, envVars: [{key,value}] }`
  — **default `replace=false`** merges with existing env vars (server fetches
  current set first and merges by key); `replace=true` replaces. After update,
  always trigger a redeploy and return `"Environment variables updated. A new
  deploy has been triggered to pick up the changes.\n\nResponse from deploying
  service: <body>"`.

### Deploys (`deploy`)
- `list_deploys { serviceId, limit?:1-100 default 10, cursor?:string }` — return
  format: JSON list followed by `\n\n cursor: <value or empty quotes>`.
- `get_deploy { serviceId, deployId }`.

### Postgres (`postgres`)
- `list_postgres_instances` — no params. Return literal text `"No Postgres
  instances found"` when empty.
- `get_postgres { postgresId }`.
- `create_postgres { name, plan?, region?, version?: 13–18 default 18, diskSizeGb? }`.
  Plan enum: free, basic_256mb, basic_1gb, basic_4gb, pro_4gb…pro_512gb,
  accelerated_16gb…accelerated_1024gb. **Free plan must reject custom disk
  size**; non-zero disk must be `1` or a multiple of `5`.
- `query_render_postgres { postgresId, sql }` — see the SQL execution rules in §6.

### Key Value (`keyvalue`)
- `list_key_value` — return `"No Key Value instances found"` when empty.
- `get_key_value { keyValueId }`.
- `create_key_value { name, plan?, region?, maxmemoryPolicy? }`.
  Plans: free, starter, standard, pro, pro_plus (reject `custom` with a dashboard
  URL). MaxmemoryPolicy enum: noeviction, allkeys_{lfu,lru,random},
  volatile_{lfu,lru,random,ttl}.

### Logs (`logs`)
- `list_logs { resource: string[] (required), level?, type?, instance?, host?,
  statusCode?, method?, path?, text?, startTime?, endTime?, direction?, limit?:1-100 }`.
  Pagination is via `nextStartTime`/`nextEndTime` returned in the body — the tool
  description must spell that out, including `hasMore`.
- `list_log_label_values { label: enum, resource (required), …same filters }`.
  Label enum: host, instance, level, method, statusCode, type.

### Metrics (`metrics`)
- `get_metrics { resourceId, metricTypes: string[] (required), startTime?,
  endTime?, resolution?: ≥30, cpuUsageAggregationMethod?: AVG|MAX|MIN,
  aggregateHttpRequestCountsBy?: host|statusCode, httpLatencyQuantile?: 0..1
  default 0.95, httpHost?, httpPath? }`.
  metricTypes enum: cpu_usage, cpu_limit, cpu_target, memory_usage, memory_limit,
  memory_target, instance_count, http_request_count, http_latency,
  bandwidth_usage, active_connections.
  - HTTP metrics + bandwidth: services only.
  - Active connections: databases + KV only.
  - `http_latency` uses `metricstypes.ServiceResourceQueryParam`; tolerate `400`
    (Hobby tier) by returning an empty time series rather than erroring.

### Tool annotations
Every tool sets explicit MCP annotations (`Title`, `ReadOnlyHint`,
`DestructiveHint`, `IdempotentHint`, `OpenWorldHint`). The only tool with
`DestructiveHint(true)` is `update_environment_variables`. The three `update_*`
stubs have `ReadOnlyHint(true)` (they only return a URL string). The TS port
must preserve this — hosts use these hints for confirmation dialogs.

---

## 4. Persistence (workspace selection only)

The server is **stateless w.r.t. Render resources** — every request goes back to
the API. The only state that has to outlive a request is the
selected workspace ID. Implemented via:

```ts
interface Store { get(sessionId: string): Promise<Session> }
interface Session {
  getWorkspace(): Promise<string>           // throws ErrNoWorkspace when unset
  setWorkspace(id: string): Promise<void>
}
```

Three backends, chosen by transport:

1. **Stdio session** → on-disk YAML at `RENDER_CONFIG_PATH` or
   `~/.render/mcp-server.yaml`, falling back to an in-memory variable seeded
   from `RENDER_WORKSPACE` if disk is unwritable.
   - YAML schema: `{ version: 1, workspace: string, api: { expires_at, host,
     refresh_token } }`. The `api` block is reserved for a future OAuth flow;
     the current code path never reads/writes refresh tokens.
   - File mode `0600`, parent dir `0755`, missing file → fresh `Config{Version:1}`.
2. **HTTP + REDIS_URL set** → Redis hash, key `session:<mcp-session-id>`,
   field `workspaceID`. `Get` does no I/O; reads/writes are lazy. No TTL.
   In production (`render.yaml`), this points at a Render Key Value store named
   `mcp-kv`.
3. **HTTP without Redis** → in-process map keyed by MCP session ID. **Not
   thread-safe** in v0; v2 should use a real concurrency-safe map.

`ErrNoWorkspace` text is doubly important — it's also a prompt to the LLM:

> "no workspace set. Prompt the user to select a workspace. Do NOT try to select
> a workspace for them, as it may be destructive"

`ErrLogin` text:

> "not authenticated; either set RENDER_API_KEY or ask your MCP host to authenticate"

The TS rewrite should keep the same `Session`/`Store` interface and the same
three backends (or substitute Bun's native SQLite for the YAML file if we want
to consolidate on SQLite — see §10).

---

## 5. Authentication & request context

Tokens live **only** in the per-request context, never on disk or in Redis.

- HTTP transport: `ContextWithAPITokenFromHeader` reads `Authorization`, strips
  optional `Bearer ` prefix (compatibility with MCP Inspector). Empty header is
  allowed at extraction time; tools fail later when they try to call Render.
- Stdio transport: `ContextWithAPITokenFromConfig` reads `RENDER_API_KEY`. Empty
  is fatal: the process exits via `log.Fatal`.

A single `*ClientWithResponses` is shared by all goroutines/sessions. The
generated client has one request editor that reads the token from the request
context and injects:

- `Authorization: Bearer <token>`
- `User-Agent: render-mcp-server/<version> (<os info>) [<client UA>]`
  (built by `cfg.AddUserAgent`; OS info collected once and memoized.)
- `X-Forwarded-For` — derived from the original `X-Forwarded-For` plus
  `req.RemoteAddr`. Avoids consecutive duplicate entries (see `buildXFF` in
  `pkg/httpcontext/httpcontext.go`) so a malicious client can't push the real
  source IP off the trusted-proxy list.

Error mapping: `pkg/client/client.go`'s `ErrorFromResponse` reflectively walks
the generated response struct, maps 401→`ErrUnauthorized`, 403→`ErrForbidden`,
otherwise returns `received response code <N>: <message>`. The TS port should
preserve uniform error shape — LLMs handle errors more deterministically when
they're consistent.

`apiTokenKey` is a string-typed context key in v0; the rest of the codebase uses
unexported `struct{}`-typed keys. **Normalize this in the TS port** by using
typed `Symbol`s or a single `RequestContext` object passed explicitly.

---

## 6. Access control & invariants to preserve

### Workspace as tenant boundary
- All list-style repos inject the active workspace's owner ID into params before
  calling the API. There is no tool argument that lets an LLM request "all
  resources across all workspaces."
- All create-style repos validate `WorkspaceMatches(ctx, request.OwnerId)`
  before calling the API, even though the owner ID was sourced from the same
  session. Belt-and-suspenders.
- `update_environment_variables` does an explicit `GetService` first to force
  the Render API to reject foreign service IDs (403/404) before mutation.

### LLM-facing soft walls
- `select_workspace` description warns the model not to call it autonomously.
- `update_*` stubs return dashboard URLs instead of mutating.
- `update_environment_variables` defaults to merge so the LLM never has to read
  existing env vars to set a new one (the description spells this out).

### SQL execution (`query_render_postgres`)
The only tool that bypasses the REST client. Hardenings to **preserve verbatim**:

- Fetch credentials via `GetPostgresConnectionInfo` (an authorized API call), so
  workspace permission is enforced upstream. Don't log them.
- Open a fresh connection per call, `defer close`, no pooling.
- Wrap in a Postgres `READ ONLY` transaction; **the database**, not the server,
  enforces read-only.
- Always `Rollback` via `defer`, even on success.
- Convert `[]byte` columns to strings; otherwise pass values through as-is.
- No timeout, no row cap, no statement parsing in v0. We may want to add these
  in v2 (statement_timeout, max rows) but it's not parity-blocking.

In TS use `pg` or `postgres` (postgres.js). Use a single connection per call:

```ts
const conn = await connect(connStr)
try {
  await conn.query('BEGIN READ ONLY')
  const result = await conn.query(sql)
  return result.rows
} finally {
  await conn.query('ROLLBACK').catch(() => {})
  await conn.end()
}
```

---

## 7. Translation layer pattern

Every tool follows this exact shape; reproduce it in TS:

```
tool schema (mcp.NewTool/zod) ──► handler ──► validate params ──► build typed
request body (sourcing ownerId from session, NOT from input) ──► repo method
──► (write side) WorkspaceMatches ──► generated client call ──► ErrorFromResponse
──► JSON.stringify(result) into mcp.NewToolResultText
```

Two-layer validation: the JSON Schema in the tool definition AND the Go handler
re-checks types/enums. The TS port should keep both layers — the schema gates
the host's coercion, the handler re-validates because schemas can drift.

Param helpers in `pkg/validate/params.go` to mirror in TS:
- `RequiredToolParam[T]` → required + type-asserted; error `"required parameter
  not present: <name>"` or `"parameter <name> is not of expected type: <T>"`.
- `OptionalToolParam[T]` → returns `(value, ok, err)`.
- `RequiredToolArrayParam[T]` / `OptionalToolArrayParam[T]`.
- `EnvVars` — walks `[]interface{}` of `{key,value}` objects, returns a single
  uniform error `"parameter envVars is not of expected type"` for every failure
  mode (don't leak input shape).
- `ServicePlan`, `KeyValuePlan`, `PostgresPlan` — enum membership; reject
  `custom` plans with a tailored dashboard URL.
- `PostgresDiskSizeGb` — `0` (free) | `1` | multiple of `5`.

Cross-field guard: in `create_postgres`, if `plan == free` and `diskSizeGb > 0`,
return `"Free plan does not support custom disk size"`.

---

## 8. Configuration surface

Environment variables to keep:

| Var | Purpose |
|---|---|
| `RENDER_API_KEY` | Bearer token (stdio mode) |
| `RENDER_HOST` | Override base API host (default `api.render.com`); URL becomes `https://<host>/v1` |
| `RENDER_CONFIG_PATH` | Override config file path (stdio) |
| `RENDER_WORKSPACE` | Seeds in-memory workspace at startup |
| `REDIS_URL` | Switch HTTP transport to Redis-backed session store |
| `OPENAI_VERIFICATION_TOKEN` | When set, server exposes `/.well-known/openai-apps-challenge` |

CLI flags:
- `-v, --version` — print version and exit.
- `-t, --transport stdio|http` (default `stdio`).

Constants:
- API base: `https://api.render.com/v1`.
- Dashboard URL: `https://dashboard.render.com` (used in tool error messages
  pointing users at the web UI).
- HTTP listen port: `:10000`. Read timeout: 5s.

Production deploy (`render.yaml`):
- `web` service, runtime go, plan standard, autoscale 1–3 instances on memory 60%.
- `keyvalue` service `mcp-kv`; its `connectionString` is wired into the web
  service as `REDIS_URL`.
- The web service's `OPENAI_VERIFICATION_TOKEN` is `sync: false` (set by hand
  in the dashboard).

---

## 9. Things to fix / reconsider in v2 (non-parity items)

These are observations from the audit, not bugs in v0. Most can be addressed
post-parity:

1. **Concurrency on the in-memory HTTP store.** v0's map is unsynchronized.
   Use a proper Map or guarded structure in TS.
2. **Context key typing.** `apiTokenKey` is a `string`. In TS, model the
   request context as a typed object instead of a key/value bag.
3. **`Bearer ` prefix handling.** v0 accepts both `Bearer X` and bare `X`.
   Decide whether to keep this MCP Inspector compatibility quirk.
4. **No Postgres safeguards beyond the read-only tx.** Consider adding
   `statement_timeout`, a max row cap, and result size cap.
5. **Update stubs return `ReadOnlyHint(true)`.** Technically correct, but they
   may invite speculative tool calls. Consider `ReadOnlyHint(false)` +
   `IdempotentHint(true)` to discourage casual calls.
6. **No CORS / rate limiting / per-request authn beyond `Authorization`.** All
   security on the HTTP path is delegated to whatever fronts the Render
   deployment plus the API itself. If the v2 server is exposed differently,
   reconsider.
7. **Refresh token slot in YAML is unused.** Decide whether v2 will implement
   OAuth or remove the field.

---

## 10. v2-specific additions (per `v2/spec.md`)

Beyond parity, v2 adds a **docs search tool** so the agent can self-educate on
Render usage.

- Stack: TypeScript on Bun. Bun has native SQLite (`bun:sqlite`); pair with
  [`sqlite-vec`](https://github.com/asg017/sqlite-vec) (the actively maintained
  successor to sqlite-vss) for vector search.
- Ship a **pre-loaded** `docs.db` with the binary/image so cold-start is fast
  and the tool works offline.
- Embeddings: a small local model (SLM) — candidates: `Xenova/all-MiniLM-L6-v2`
  (384d) via `@xenova/transformers`, or a Bun-friendly equivalent. Pick once
  based on bundle size + quality.
- New tool: `search_docs { query: string, limit?: number }` returning the top-k
  doc chunks with URLs, titles, and the relevant snippet.
- **Ingestion/indexing/maintenance** is the open question (per spec.md item 3):
  - Snapshot Render's docs site at build time → embed → write to `docs.db` →
    bake into the image.
  - Refresh strategy: nightly CI job that re-crawls, re-embeds changed pages,
    publishes a new image tag. Server can also fetch a remote `docs.db` on
    startup if `RENDER_DOCS_DB_URL` is set, falling back to the bundled copy.
  - Schema sketch: `docs(id, url, title, section, hash, updated_at, content)`
    + `docs_vec(rowid, embedding)` virtual table. Use `hash` to skip
    re-embedding unchanged pages.

The docs DB is the natural place to also consolidate v2's "session/workspace
on disk" persistence if we want to drop YAML — one SQLite file, two tables.

---

## 11. Migration checklist for the TS port

Initial parity milestone:

- [ ] Set up Bun project, MCP TS SDK (`@modelcontextprotocol/sdk`), Zod for
      tool schemas.
- [ ] Implement `Session`/`Store` interfaces with three backends (file/SQLite,
      Redis, in-memory).
- [ ] Implement `RequestContext` carrying token, user-agent, XFF.
- [ ] Wire transports: stdio (default) and HTTP streamable on `:10000` with
      `/mcp` and `/.well-known/openai-apps-challenge` routes.
- [ ] Generate or hand-write a typed Render API client targeting
      `https://api.render.com/v1`. (OpenAPI-codegen with `openapi-typescript` +
      `openapi-fetch` is the obvious choice.) Inject auth/UA/XFF via a single
      middleware.
- [ ] Port all ~25 tools — names, params, descriptions, annotations,
      response shapes verbatim.
- [ ] Port `validate.*` helpers; preserve exact error strings.
- [ ] Port `WorkspaceMatches` and the workspace injection in list repos.
- [ ] Port `query_render_postgres` with a fresh connection + READ ONLY tx +
      always-rollback.
- [ ] Port `mergeEnvVars` semantics for `update_environment_variables` and the
      auto-redeploy after update.
- [ ] Port `ErrorFromResponse` semantics: 401 → ErrUnauthorized, 403 →
      ErrForbidden, otherwise `received response code <N>: <message>`.
- [ ] Tests: port the session tests (in-memory + Redis via miniredis-equivalent;
      Bun has no miniredis, use a real ephemeral container or
      [`redis-memory-server`](https://www.npmjs.com/package/redis-memory-server)
      style harness).
- [ ] CI: replace GoReleaser with a Bun build + Docker image + GitHub release.

After parity:

- [ ] `search_docs` tool + `docs.db` build pipeline.
- [ ] Nightly docs refresh job + remote DB download path.
- [ ] Decide on consolidating workspace persistence into the same SQLite file.
