# CLAUDE.md — aio-scrap-crawl

Permanent reference for Claude Code sessions working on this project.  
**Before making any significant change, always read `CLAUDE_CONTEXT.md` first.**

---

## Project Overview

**aio-scrap-crawl** is an All-In-One scraping and crawling orchestration platform. It unifies 10 open-source tools behind a single TypeScript core, CLI and (planned) REST API. The design principle is **orchestration, not fusion**: every tool becomes a pluggable engine behind a shared interface; swapping engines is one string change.

Origin: intelligent merge of 10 repos (Crawlee, Crawl4AI, ScrapeGraphAI, Firecrawl, Katana, browser-use, Playwright, Scrapy, WipeDown, Maxun). None of the original repos were modified or vendored.

---

## Architecture

### Control Plane

TypeScript monorepo (pnpm workspaces + Turborepo). Node.js ≥ 20, ESM (`"type": "module"`), TypeScript 5.7 strict mode, `"moduleResolution": "Bundler"`. Built with `tsup` (ESM + `.d.ts`).

### Engine / Adapter Pattern

Every scraping/crawling backend implements `ScrapeEngine` and/or `CrawlEngine` from `@aio/core`:

```typescript
interface Engine {
  readonly name: string
  readonly capabilities: EngineCapabilities  // { scrape, crawl, javascript, markdown, structured, agent }
  isAvailable(): Promise<boolean>            // graceful degradation
}
interface ScrapeEngine extends Engine { scrape(job: ScrapeJob): Promise<PageData> }
interface CrawlEngine  extends Engine { crawl(job: CrawlJob, onPage?: PageSink): Promise<CrawlResult> }
```

`EngineRegistry` holds all registered engines. The CLI/API selects by name; unavailable engines fail with a clear error rather than crashing.

### Universal Data Model (`@aio/core`)

- **Input:** `ScrapeJob` (single URL) / `CrawlJob` (site crawl with limits, patterns, robots)
- **Output:** `PageData` — the single normalized unit for every engine and exporter:
  `url, finalUrl, statusCode, ok, title, description, html?, text?, markdown?, links[], images[], metadata{}, structuredData?, fetchedAt, engine, error?`
- **Aggregate:** `CrawlResult` — `{ startUrl, pages[], count, durationMs, engine }`

### Process Boundaries

| Tier | Technology | Reason |
|---|---|---|
| TypeScript core | Node.js native | Control plane, speed, single runtime |
| Python AI engines | FastAPI microservice (`services/py-ai`) | Crawl4AI/ScrapeGraphAI/browser-use live here natively |
| Go URL discovery | `katana` binary (`child_process.spawn`) | MIT binary, JSONL output parsed into PageData |
| AGPL services | HTTP only (Docker) | Firecrawl, Maxun — never vendored, process isolation = no license contamination |

### AGPL Isolation Rule

Firecrawl (AGPL-3.0) and Maxun (AGPL-3.0) are **consumed only over HTTP** as separate services. They are **never imported** into `packages/`, `modules/` or `apps/`. The core/adapters/CLI remain MIT/Apache-2.0. Document the license boundary in every adapter file.

---

## Package Structure

```
aio-scrap-crawl/
├── packages/
│   ├── core/        @aio/core     — contract, registry, config, logger, exporters,
│   │                               URL utils, robots cache, FetchEngine (zero deps)
│   ├── crawler/     @aio/crawler  — CrawleeEngine (Crawlee Apache-2.0, CheerioCrawler)
│   ├── adapters/    @aio/adapters — FirecrawlAdapter, KatanaAdapter, PyAiAdapter
│   └── ai/          @aio/ai       — LLM provider facade (stub over py-ai)
├── modules/
│   └── security/    @aio/security — WipeDown prompt-injection sanitizer (local + client)
├── apps/
│   ├── cli/         @aio/cli      — unified `aio` CLI (Commander.js)
│   ├── web/                       — planned: no-code web UI
│   └── desktop/                   — planned: Electron/Tauri
├── services/
│   └── py-ai/                     — FastAPI: Crawl4AI / ScrapeGraphAI / browser-use / WipeDown
├── scripts/
│   └── example-crawl.mjs          — offline 5-page demo
├── config/                        — example config file
└── [docs: ARCHITECTURE.md, MERGE_ANALYSIS.md, MIGRATION_NOTES.md, TODO.md, CHANGELOG.md]
```

### Workspace Dependencies

```
@aio/cli → @aio/core, @aio/adapters, @aio/ai, @aio/crawler, @aio/security
@aio/adapters → @aio/core
@aio/crawler  → @aio/core  (+ crawlee)
@aio/security → (no deps)
@aio/core     → dotenv, zod
```

Build order is enforced by Turborepo (`turbo.json`).

---

## Key Files

| File | Purpose |
|---|---|
| `packages/core/src/types.ts` | `PageData`, `ScrapeJob`, `CrawlJob`, `CrawlResult`, `PageSink` |
| `packages/core/src/engine.ts` | `Engine`, `ScrapeEngine`, `CrawlEngine`, `EngineCapabilities`, `EngineUnavailableError` |
| `packages/core/src/registry.ts` | `EngineRegistry` — in-memory engine lookup |
| `packages/core/src/config.ts` | `loadConfig()` — dotenv + zod, memoized singleton, `resetConfig()` for tests |
| `packages/core/src/exporters.ts` | `serialize()`, `exportToFile()`, `defaultOutputPath()` — JSON/JSONL/CSV |
| `packages/core/src/engines/fetch-engine.ts` | `FetchEngine` — zero-dep built-in scrape + crawl |
| `packages/core/src/url.ts` | `normalizeUrl()`, `UrlDeduper`, `compilePatterns()`, `matchesAny()` |
| `packages/core/src/robots.ts` | `RobotsCache` — basic robots.txt parsing |
| `packages/core/src/html.ts` | `extractTitle/Metadata/Links/Images()`, `htmlToText()`, `decodeEntities()` |
| `packages/crawler/src/index.ts` | `CrawleeEngine` (CheerioCrawler) |
| `packages/adapters/src/firecrawl.ts` | `FirecrawlAdapter` (HTTP → AGPL service) |
| `packages/adapters/src/katana.ts` | `KatanaAdapter` (child_process → Go binary) |
| `packages/adapters/src/pyai.ts` | `PyAiAdapter` (HTTP → FastAPI service) |
| `modules/security/src/index.ts` | `sanitizeText()`, `WipeDownClient`, `sanitize()` |
| `apps/cli/src/index.ts` | CLI commands: `scrape`, `crawl`, `engines` |
| `apps/cli/src/registry-factory.ts` | `buildRegistry()` — assembles all engines from config |
| `services/py-ai/app/main.py` | FastAPI stubs: `/health`, `/scrape`, `/extract`, `/sanitize` |
| `.env.example` | All config variables documented with defaults |
| `docker-compose.yml` | Optional companion services (py-ai, Firecrawl, Maxun) |

---

## Configuration (dotenv + zod)

All config is read from environment / `.env`. No file-based config yet.  
Parsed in `packages/core/src/config.ts` → `AioConfig` type.

Key env vars:

| Variable | Default | Notes |
|---|---|---|
| `AIO_DEFAULT_ENGINE` | `fetch` | Engine when `--engine` not set |
| `AIO_LOG_LEVEL` | `info` | `debug\|info\|warn\|error\|silent` |
| `AIO_LOG_JSON` | `false` | JSON-line log output |
| `AIO_OUTPUT_DIR` | `./output` | Crawl result directory |
| `AIO_MAX_PAGES` | `50` | Crawl page cap |
| `AIO_MAX_DEPTH` | `2` | Crawl depth |
| `AIO_CONCURRENCY` | `5` | Parallel requests |
| `AIO_DELAY_MS` | `0` | Politeness delay (ms) |
| `AIO_RESPECT_ROBOTS` | `true` | Honour robots.txt |
| `AIO_SECURITY_SANITIZE` | `true` | Run WipeDown before output |
| `FIRECRAWL_API_URL` | — | Enables `--engine firecrawl` |
| `FIRECRAWL_API_KEY` | — | Firecrawl auth |
| `KATANA_BIN` | `katana` | Path to katana binary |
| `PYAI_URL` | `http://127.0.0.1:8099` | Enables `--engine pyai` |
| `WIPEDOWN_URL` | — | Dedicated WipeDown endpoint |
| `OPENAI_API_KEY` | — | Used by py-ai service |
| `ANTHROPIC_API_KEY` | — | Used by py-ai service |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Used by py-ai service |

---

## Development Commands

```bash
# Setup
pnpm install                # install all deps (473 packages)
cp .env.example .env        # configure (all have defaults)

# Build
pnpm build                  # build all packages via Turborepo
pnpm clean                  # rm dist/ .turbo/ across all packages

# Type checking
pnpm typecheck              # tsc --noEmit across all packages

# Testing
pnpm test                   # vitest run (14 tests, all offline)
pnpm test:watch             # vitest watch mode

# Run CLI (after build)
pnpm aio scrape <url>
pnpm aio crawl <url> [--max-pages N] [--max-depth N] [--engine crawlee|fetch]
pnpm aio engines

# Demo (offline, no network)
pnpm example:crawl

# Python AI service (optional)
cd services/py-ai
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8099
# or: docker compose up py-ai
```

---

## Technology Stack

### TypeScript / Node.js (core)
- **Runtime:** Node.js ≥ 20 (uses native `fetch`, `node:http`, `node:child_process`)
- **Package manager:** pnpm 10.33.0 with workspaces
- **Build orchestration:** Turborepo 2.3.x
- **Bundler:** tsup 8.x (ESM + `.d.ts` per package)
- **TypeScript:** 5.7.x, `strict: true`, `"moduleResolution": "Bundler"`, `"target": "ES2022"`
- **Testing:** Vitest 2.1.x (offline, uses `node:http` local servers)
- **CLI framework:** Commander.js 12.x
- **Config validation:** dotenv 16.x + zod 3.x
- **Crawling library:** Crawlee 3.13.x (`CheerioCrawler`, `CheerioCrawlingContext`)

### Python (services/py-ai)
- **Runtime:** Python ≥ 3.11
- **Web framework:** FastAPI 0.115+ with Uvicorn
- **Data validation:** Pydantic 2.9+
- **Optional AI libs** (uncommented in `requirements.txt` when wiring):
  - `crawl4ai` ≥ 0.4 — Markdown scraping
  - `scrapegraphai` ≥ 2.1 — Structured LLM extraction
  - `browser-use` ≥ 0.13 — Agentic browser automation
  - `wipedown` ≥ 1.0 — LLM semantic sanitization

### Go (external binary)
- `katana` binary from `github.com/projectdiscovery/katana`
- Spawned via `child_process.spawn`, JSONL output parsed into `PageData`

---

## Conventions

### Adding a New Engine

1. Create a package in `packages/` or `modules/` implementing `ScrapeEngine`/`CrawlEngine`
2. Map the engine's output to `PageData` — every field must be present (use defaults for optional ones)
3. Implement `isAvailable(): Promise<boolean>` — return `false` when dependency is missing
4. Register in `apps/cli/src/registry-factory.ts`
5. Document capabilities (JS, markdown, structured, agent) in `readonly capabilities`
6. Add environment variable to `.env.example` and `packages/core/src/config.ts`

### Security: WipeDown Is Mandatory Before Any LLM

Scraped content is untrusted and can carry prompt-injection payloads. Always apply `sanitizeText()` from `@aio/security` (or the `WipeDownClient` service) before passing any page content to an LLM. The CLI does this automatically unless `--no-sanitize` is passed.

### HIDDEN_CHARS Regex Warning

In `modules/security/src/index.ts`, the `HIDDEN_CHARS` regex **must** be written as `new RegExp(...)` with `\u` hex escapes — never with literal invisible characters pasted inline. Editors and write tools tend to re-materialize them, breaking the regex silently.

### Test Strategy

- All tests must be **offline** (no real network). Use `node:http` `createServer` for E2E.
- Use `String.fromCharCode(0xNNNN)` for Unicode code-point tests, never paste invisible characters literally.
- Call `resetConfig()` from `@aio/core` in test teardown when tests modify env vars.

### Output Paths

- `aio crawl` auto-writes to `AIO_OUTPUT_DIR` (default `./output/`) as `crawl-<host>-<ts>.<fmt>`
- `aio scrape` writes to stdout (or `--out <file>`)

---

## Licensing Summary

| Scope | License |
|---|---|
| `packages/`, `modules/`, `apps/`, `services/py-ai` | **MIT** |
| Crawlee (dependency) | Apache-2.0 |
| Firecrawl (external HTTP service) | AGPL-3.0 — never vendored |
| Maxun (external HTTP service) | AGPL-3.0 — never vendored |
| Playwright (transitive dep via Crawlee) | Apache-2.0 |
| Katana (external binary) | MIT |

---

## Rules for Claude Code

1. **Read `CLAUDE_CONTEXT.md`** before any significant change to understand current state.
2. **Update `CLAUDE_CONTEXT.md`** after completing a significant task or decision.
3. Never vendor AGPL code into `packages/`, `modules/`, or `apps/`. Use HTTP adapters only.
4. Every new engine must return valid `PageData` with all required fields (`url`, `ok`, `links`, `images`, `metadata`, `fetchedAt`, `engine`).
5. All tests must be offline (no `fetch` to real URLs in tests).
6. Do not add comments explaining *what* code does — only explain *why* when non-obvious.
7. Do not add error handling for scenarios that cannot happen. Trust TypeScript types.
8. Do not create new files when editing an existing one is sufficient.
9. Run `pnpm typecheck && pnpm test` after any non-trivial change to packages.
10. When a new env var is needed, add it to both `.env.example` and `packages/core/src/config.ts`.
