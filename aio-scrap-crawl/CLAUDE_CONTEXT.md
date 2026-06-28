# CLAUDE_CONTEXT.md — Living Development Memory

**Purpose:** tracks current state, decisions, blockers and next steps.  
**Update this file** whenever a significant task completes or a technical decision is made.  
Last updated: 2026-06-25

---

## Current Status: v0.2.0 — 12 repos integrated ✅

The AIO scaffold (Phase 1–6) is complete and validated. On 2026-06-25 two newly
added source repos were folded in (total **12**): **Scrapling** integrated as the
`scrapling` stealth/adaptive engine; **MasterDnsVPN** kept out of the core and
documented as an optional SOCKS5 egress (it is a DNS-tunnel transport, not a
scraper). All packages build, 14/14 tests pass, zero TypeScript errors, CLI lists
the new engine. The project is ready for GitHub publication.

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
- `ScraplingAdapter` — HTTP POST to py-ai `/scrape` with `engine: "scrapling"`; stealth/adaptive scrape (BSD-3); shares `PYAI_URL` with `pyai`

### Captcha (`@aio/captcha`) — 2captcha real, ai-vision stub
- `CaptchaSolver` interface (`CaptchaChallenge` → `CaptchaSolution`), `createCaptchaSolver()`
- `TwoCaptchaProvider` (real) → py-ai `/captcha/solve`; covers recaptcha v2/v3, hcaptcha, turnstile, funcaptcha, geetest, image, text
- `AiVisionProvider` (stub) → self-hosted LMM solver, `not-implemented` until wired
- py-ai `/captcha/health` reports per-provider readiness; `aio captcha <type>` CLI command
- `TWOCAPTCHA_API_KEY` stays server-side; providers degrade with `isAvailable(): false`

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

### Python Service (`services/py-ai`) — Scrapling live; rest stubs
- FastAPI app with `/health`, `/scrape`, `/extract`, `/sanitize`
- `/scrape` routes by `engine`: **`scrapling` is a real implementation**
  (`_scrape_scrapling` → `StealthyFetcher`/`Fetcher`, mapped to `PageData`, with a
  browser→HTTP fallback recorded in `metadata["scrapling.stealth_error"]`).
  `crawl4ai` path is still a stub.
- `/extract`, `/sanitize` return valid stub responses so adapters degrade gracefully
- `requirements.txt` lists optional libs commented-out; `scrapling[fetchers]` is the
  one actually exercised (installed in the dev env: scrapling 0.4.9).

### AI (`@aio/ai`) — stub
- Placeholder module; forwards to py-ai service
- No real implementation yet

### Documentation
- `README.md` — comprehensive GitHub README ✅ (updated 2026-06-15)
- `ARCHITECTURE.md` — full design with layer diagram
- `MERGE_ANALYSIS.md` — technical analysis of the 12 source repos
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
| Scrapling `StealthyFetcher` browser can't spawn in sandbox (`spawn UNKNOWN`) | Env-only; falls back to HTTP Fetcher | works on a host that can launch the browser |
| py-ai `/scrape` crawl4ai path, `/extract`, `/sanitize` are stubs | Pending | `services/py-ai/app/main.py` — `TODO(integration)` blocks present |
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

### 2026-06-27 — Activate real Scrapling engine + analyze captcha repos

**Completed:**
- **Scrapling wired for real** in `services/py-ai/app/main.py` (`_scrape_scrapling` +
  `_scrapling_to_page` + `_dedupe`): `StealthyFetcher` when `stealth=true`, HTTP
  `Fetcher` otherwise; maps Scrapling's `Response`/`Selector` (`.css('::text')`,
  `.attrib`, `.urljoin`, `.get_all_text`, `.html_content`, `.status`) to `PageData`.
  Resilient imports: HTTP `Fetcher` works without the browser stack; stealth import is
  lazy and failures fall back with `metadata["scrapling.stealth_error"]`.
- Installed `scrapling[fetchers]` (0.4.9) + FastAPI/uvicorn in the dev env. Verified
  **live end-to-end**: CLI → `ScraplingAdapter` → service → real Scrapling →
  `PageData` (real title/text/links/status on example.com). `aio engines` →
  `scrapling: available:true` with the service up.
- `scrapling install` ran (Playwright browsers) but the chromium binary won't spawn
  in this sandbox (`spawn UNKNOWN`) even with sandbox disabled → engine falls back to
  HTTP as designed. Stealth works on a host that can launch the browser.
- `requirements.txt` hint corrected to `scrapling[fetchers]` (+ `scrapling install`).
- Updated README, CHANGELOG (v0.2.0 verified section), TODO to reflect "real, not stub".
- **Captcha layer BUILT** (`@aio/captcha`): `CaptchaSolver` interface +
  `TwoCaptchaProvider` (real, wraps `twocaptcha` in py-ai) + `AiVisionProvider` (stub).
  py-ai `/captcha/solve` + `/captcha/health`; `aio captcha <type>` CLI. Verified
  end-to-end (CLI → adapter → py-ai → live 2captcha.com call → graceful error with a
  dummy key; with a valid `TWOCAPTCHA_API_KEY` it returns the token). `repos-captch/`
  analysis: 2captcha-python = primary (done); ai-captcha-bypass = ai-vision (stub);
  captcha_bypass (no license) + Privacy Pass (deprecated) = reference only.
  Build 7 pkgs, typecheck 13/13, tests 23/23 green.

### 2026-06-25 — Integrate 2 new repos (Scrapling, MasterDnsVPN)

**Context:** `repos/` grew from 10 → 12. The two new repos (`Scrapling-main`,
`MasterDnsVPN-main`) were untracked and absent from the original analysis.

**Completed:**
- Verified the existing scaffold still green before touching it (11 typecheck tasks, 14/14 tests).
- **Scrapling (BSD-3) → integrated** as engine `scrapling`:
  - `packages/adapters/src/scrapling.ts` (`ScraplingAdapter`), exported from the barrel, registered in `apps/cli/src/registry-factory.ts` (shares `PYAI_URL`).
  - `services/py-ai/app/main.py`: `/scrape` now routes by `engine` field → `_scrape_crawl4ai` / `_scrape_scrapling` (stub + `TODO(integration)` showing `StealthyFetcher`). Added `scrapling` (commented) to `requirements.txt`.
  - `.env.example`: engine list + py-ai section updated.
- **MasterDnsVPN (MIT) → kept out of core** (it is a DNS-tunnel transport, not a scraper). Documented as optional SOCKS5 egress: commented `AIO_PROXY_URL` in `.env.example`, README section, MIGRATION/TODO entries. No code in core.
- Updated docs: `MERGE_ANALYSIS.md` (12 repos: §2.11, §2.12, dedup + architecture tables), `MIGRATION_NOTES.md`, `TODO.md`, `CHANGELOG.md` (v0.2.0), `README.md`.
- Re-validated: build + typecheck + 14/14 tests green; `aio engines` lists `scrapling`; `py_compile` clean.

**Decisions made:**
- Scrapling gets its own engine (not merged into `pyai`) because its differentiators (anti-bot stealth, self-healing selectors) deserve first-class `--engine scrapling` selection. Same `PYAI_URL` process, routed via `engine` field — no second service/port.
- MasterDnsVPN excluded on **relevance**, not license. Kept honest: no dead config field that core ignores; `AIO_PROXY_URL` is commented and its Crawlee wiring is an explicit TODO.

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
