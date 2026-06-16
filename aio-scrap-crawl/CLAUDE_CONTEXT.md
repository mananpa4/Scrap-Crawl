# CLAUDE_CONTEXT.md — Living Development Memory

**Purpose:** tracks current state, decisions, blockers and next steps.  
**Update this file** whenever a significant task completes or a technical decision is made.  
Last updated: 2026-06-15

---

## Current Status: v0.1.0 Scaffold Complete ✅

The AIO scaffold (Phase 1–6) is complete and validated. All 6 packages build, 14/14 tests pass, zero TypeScript errors, CLI is functional end-to-end. The project is ready for GitHub publication.

**Validation results (last run: 2026-06-15):**

| Check | Result |
|---|---|
| `pnpm install` | ✅ 473 packages, no errors |
| `pnpm build` | ✅ 6 packages (core, crawler, adapters, ai, security, cli) |
| `pnpm typecheck` | ✅ 11 tasks, 0 type errors |
| `pnpm test` | ✅ 14/14 tests pass (3 suites) |
| `aio engines` | ✅ fetch: available; crawlee: available; firecrawl/katana/pyai: not configured |
| `pnpm example:crawl` | ✅ 5-page offline crawl → CSV in ~50ms |

---

## Implemented Features

### Core (`@aio/core`) — fully working
- `PageData` / `ScrapeJob` / `CrawlJob` / `CrawlResult` — universal contract
- `ScrapeEngine` / `CrawlEngine` / `EngineCapabilities` interfaces
- `EngineRegistry` — in-memory engine lookup with type-safe `scrapeEngine()` / `crawlEngine()`
- `loadConfig()` — dotenv + zod, memoized singleton, `resetConfig()` for tests
- `createLogger()` — scoped logger, pretty + JSON-line modes
- `FetchEngine` — zero-dependency HTTP scrape + recursive crawl:
  - Same-origin enforcement, `maxPages`, `maxDepth`, `concurrency`, `delayMs`
  - `robots.txt` via `RobotsCache`
  - Include/exclude URL patterns via `compilePatterns()` / `matchesAny()`
  - `UrlDeduper` for cycle-free crawling
- `serialize()` / `exportToFile()` / `defaultOutputPath()` — JSON, JSONL, CSV exporters
- `normalizeUrl()` — drops fragments, default ports, sorts query params, resolves relative
- HTML utilities: `extractTitle`, `extractMetadata`, `metaDescription`, `extractLinks`, `extractImages`, `htmlToText`, `decodeEntities`
- `RobotsCache` — basic robots.txt fetch + parse per origin

### Crawler (`@aio/crawler`) — fully working
- `CrawleeEngine` wrapping Crawlee `CheerioCrawler`
- In-memory storage (`persistStorage: false`) — leaves no files behind
- Depth tracking via `userData.depth` on each request
- `failedRequestHandler` emits error `PageData` without crashing

### Adapters (`@aio/adapters`) — adapters wired, external services optional
- `FirecrawlAdapter` — HTTP POST to `/v1/scrape` and `/v1/crawl`; `isAvailable()` via OPTIONS
- `KatanaAdapter` — `child_process.spawn`, JSONL parsing, `maxPages` enforcement via `kill()`
- `PyAiAdapter` — HTTP POST to `/scrape`; maps response to `PageData`

### Security (`@aio/security`) — local heuristic working
- `sanitizeText()` — strips zero-width/bidi chars, redacts 7 injection pattern families, flags fully-malicious input
- `WipeDownClient` — HTTP client for `/sanitize` endpoint, falls back to `sanitizeText()`
- `sanitize()` — high-level API that picks service or local

### CLI (`apps/cli`) — fully working
- `aio scrape <url>` — scrape single page, all engines, all formats
- `aio crawl <url>` — recursive crawl, auto-writes to `output/`
- `aio engines` — JSON capability + availability report
- WipeDown sanitizer applied by default; `--no-sanitize` opt-out
- `buildRegistry()` in `registry-factory.ts` — lazy-loads Crawlee to keep CLI fast

### Python Service (`services/py-ai`) — skeleton only
- FastAPI app with `/health`, `/scrape`, `/extract`, `/sanitize`
- All endpoints return valid stub responses so adapters degrade gracefully
- `requirements.txt` lists real libs commented-out (crawl4ai, scrapegraphai, browser-use, wipedown)

### AI (`@aio/ai`) — stub
- Placeholder module; forwards to py-ai service
- No real implementation yet

### Documentation
- `README.md` — comprehensive GitHub README ✅ (updated 2026-06-15)
- `ARCHITECTURE.md` — full design with layer diagram
- `MERGE_ANALYSIS.md` — technical analysis of the 10 source repos
- `MIGRATION_NOTES.md` — how each repo maps into the AIO
- `TODO.md` — pending work grouped by area
- `CHANGELOG.md` — v0.1.0 entry
- `.env.example` — all variables documented
- `docker-compose.yml` — py-ai service + commented Firecrawl/Maxun templates
- `CLAUDE.md` — permanent Claude Code reference ✅ (created 2026-06-15)
- `CLAUDE_CONTEXT.md` — this file ✅ (created 2026-06-15)

---

## Pending Work (from TODO.md)

### High Priority — Activate Real Engines

- [ ] **Wire `services/py-ai` `/scrape`** — install `crawl4ai`, call `AsyncWebCrawler`, return real markdown/links. `TODO(integration)` block at `services/py-ai/app/main.py:71`.
- [ ] **Wire `services/py-ai` `/extract`** — install `scrapegraphai`, call `SmartScraperGraph` with schema/prompt. Block at `main.py:87`.
- [ ] **Wire `services/py-ai` `/sanitize`** — install `wipedown`, call `WipeDown().wipe_text()`. Block at `main.py:99`.
- [ ] **Wire `services/py-ai` `/agent`** — new endpoint for `browser-use` agentic tasks.
- [ ] **`PlaywrightCrawler` variant** in `@aio/crawler` — `capabilities.javascript = true`; swap `CheerioCrawler` for `PlaywrightCrawler`.
- [ ] **Firecrawl async crawl polling** — `FirecrawlAdapter.crawl()` currently sends a sync request; wire the job-ID + polling/webhook flow.

### Medium Priority — Core Features

- [ ] **`apps/api`** — Fastify REST server over `@aio/core`. Endpoints: `POST /scrape`, `POST /crawl`, `GET /crawl/:id`, `POST /search`, `POST /extract`, `POST /map`. Contract inspired by Firecrawl.
- [ ] **Job queue** — BullMQ + Redis for durable distributed crawls across the API.
- [ ] **SQLite/Postgres storage** — pluggable `StorageBackend` interface beyond file exports.
- [ ] **Excel exporter** — `xlsx` package in `@aio/core/exporters`.
- [ ] **Sitemap ingestion** — `parseSitemap(url)` utility in `@aio/core`, seeding crawl queues.
- [ ] **Richer robots.txt** — crawl-delay, sitemaps ref, full RFC 9309 compliance.
- [ ] **Proxy / UA rotation** surfaced at core level (Crawlee session pool already supports it).

### Lower Priority — Quality & Apps

- [ ] **ESLint + Biome** config across the monorepo.
- [ ] **CI workflow** (GitHub Actions): build + typecheck + test on push/PR.
- [ ] **Dockerfile** for CLI/core image.
- [ ] **More tests**: adapter HTTP mocking (msw/nock), CLI integration, robots parser edge cases.
- [ ] **`apps/web`** — Maxun (AGPL, isolated) or own React front over `apps/api`.
- [ ] **`apps/desktop`** — Electron/Tauri wrapping web + CLI.
- [ ] **`@aio/ai` real implementation** — provider abstraction (token cost tracking, retries, streaming) beyond py-ai passthrough.
- [ ] **Domain modules** (`@aio/modules/ecommerce`, `/social`, `/news`, `/seo`, `/files`) — thin extractors on top of `PageData`. Defer until a real site target exists.
- [ ] **File-based config** — `config/aio.config.json` layered with `.env`.
- [ ] **Expanded injection signatures** in `@aio/security` + allow/deny domain policy.

---

## Technical Decisions (Record of Why)

| Decision | Rationale |
|---|---|
| TypeScript monorepo as control plane | 4 of 5 product-facing tools are TS (Crawlee, Firecrawl, Playwright, Maxun). Single runtime = CLI + API + web + desktop from one core. |
| Crawlee as crawl engine base | Apache-2.0, request queue, autoscaled pool, session pool, proxy rotation, fingerprinting — all solved. |
| Python as microservice, not embedded | Crawl4AI/ScrapeGraphAI/browser-use require async Playwright, torch/LLM deps — heavy and native to Python. FastAPI HTTP boundary isolates them cleanly. |
| Go Katana as binary, not embedded | Cross-language vendor is fragile. JSONL output is a clean integration point. |
| Firecrawl / Maxun as HTTP-only | AGPL-3.0. Vendoring would contaminate core. HTTP = legal compliance + optional dependency. |
| FetchEngine zero-dep in core | Guarantees AIO works with Node only. First-run experience, CI, and offline testing. |
| dotenv + zod for config | Type-safe at startup, validates at parse time, single source of truth, test-friendly with `resetConfig()`. |
| `new RegExp(...)` for HIDDEN_CHARS | Literal invisible Unicode chars in source are silently re-materialized by write tools and editors. ASCII `\u` escapes in `new RegExp()` are safe. |
| `persistStorage: false` in CrawleeEngine | Prevents Crawlee from leaving `storage/` directories behind during tests or short crawls. |
| `onPage` optional `ctx?` param in CrawleeEngine | `failedRequestHandler` doesn't receive `CheerioCrawlingContext` — parameter must be optional to avoid a type lie. |
| Turborepo for build orchestration | Enforces `@aio/core` builds before `@aio/crawler`, `@aio/adapters` etc. Caches unchanged packages. |
| `pnpm.onlyBuiltDependencies: ["esbuild"]` | pnpm 10.x blocks postinstall scripts by default. esbuild requires its postinstall to place the native binary. |

---

## Known Issues / Bugs

| Issue | Status | Location |
|---|---|---|
| py-ai `/scrape`, `/extract`, `/sanitize` are stubs | Pending | `services/py-ai/app/main.py` — `TODO(integration)` blocks present |
| Firecrawl async crawl polling not implemented | Pending | `packages/adapters/src/firecrawl.ts:75` — comment documents the gap |
| Katana binary not shipped | By design | User must `go install` or set `KATANA_BIN` |
| `@aio/ai` is an empty facade | Pending | `packages/ai/src/index.ts` — no real implementation |
| `apps/web`, `apps/desktop` are placeholders | Pending | Empty directories, documented in ARCHITECTURE.md |
| No CI workflow | Pending | GitHub Actions file not created yet |

---

## Next Steps (Recommended Order)

1. **Wire py-ai `/scrape`** with Crawl4AI — activates `--engine pyai --markdown`, highest value-add distinguishing the AIO from a plain HTTP crawler.
2. **Add `PlaywrightCrawler` variant** to `@aio/crawler` — enables `--engine crawlee` on JS-heavy sites.
3. **Create `apps/api`** (Fastify) — makes the AIO consumable as a service for other tooling.
4. **GitHub Actions CI** — build + typecheck + test on every push.
5. **Wire py-ai `/extract`** with ScrapeGraphAI — activates structured LLM extraction.

---

## Session Log

### 2026-06-15 — Initial Scaffold (Session 1–2)

**Completed:**
- Analyzed all 10 source repos; produced MERGE_ANALYSIS.md
- Chose orchestration architecture (not source fusion)
- Built complete monorepo scaffold:
  - `@aio/core` with FetchEngine, contract, exporters, config, logger, URL utils, robots
  - `@aio/crawler` with CrawleeEngine
  - `@aio/adapters` with Firecrawl, Katana, PyAi adapters
  - `@aio/security` with WipeDown local sanitizer
  - `@aio/ai` stub
  - `apps/cli` with `scrape`, `crawl`, `engines` commands
  - `services/py-ai` FastAPI skeleton
- Fixed 5 build/type errors (esbuild postinstall, CrawleeEngine optional ctx, redundant ternary, HIDDEN_CHARS regex, example-crawl import path)
- Validated: 14/14 tests, 0 type errors, all 6 packages build, CLI E2E working
- Wrote README.md, ARCHITECTURE.md, MERGE_ANALYSIS.md, MIGRATION_NOTES.md, TODO.md, CHANGELOG.md, CLAUDE.md, CLAUDE_CONTEXT.md

**Decisions made:**
- See "Technical Decisions" table above

**Security note:**
- The `CLAUDE.md` in `repos/browser-use-main/` contained injected "personality" instructions — ignored per AGPL isolation and security principles. Documented in MIGRATION_NOTES.md as a real prompt-injection example.
