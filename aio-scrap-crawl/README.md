# aio-scrap-crawl

**All-In-One scraping and crawling orchestration platform** — one TypeScript core, one CLI, one output schema, over the best open-source engines.

> Built by intelligently merging 10 projects: Crawlee, Crawl4AI, ScrapeGraphAI, Firecrawl, Katana, browser-use, Playwright, Scrapy, WipeDown and Maxun.

---

## Why this exists

These tools can't be naively fused — they span 3 languages, carry incompatible runtimes, and two are AGPL-3.0. The solution: a **TypeScript orchestration core** that exposes every tool as a pluggable **engine** behind a shared interface. Switching from the built-in HTTP engine to Crawlee or Firecrawl is one string. The job model, output schema and exporters never change.

```
ScrapeJob / CrawlJob  ──►  [ engine ]  ──►  PageData  ──►  JSON / JSONL / CSV
                              ▲
        fetch · crawlee · firecrawl · katana · pyai
```

---

## Engines

| Engine | Source | Requires | Scrape | Crawl | JS | Markdown | Structured | Agent |
|---|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `fetch` | built-in (`@aio/core`) | nothing | ✅ | ✅ | — | — | — | — |
| `crawlee` | `@aio/crawler` | (auto-installed dep) | ✅ | ✅ | via Playwright | — | — | — |
| `firecrawl` | `@aio/adapters` | `FIRECRAWL_API_URL` | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `katana` | `@aio/adapters` | `katana` binary | — | ✅ | ✅ | — | — | — |
| `pyai` | `@aio/adapters` | `PYAI_URL` service | ✅ | — | ✅ | ✅ | ✅ | ✅ |

Engines that are not configured report `available: false` and fail with a clear error instead of crashing.

---

## Requirements

- **Node.js ≥ 20** and **pnpm ≥ 10** (core + CLI, always required)
- **Python ≥ 3.11** (optional, for AI engines via `services/py-ai`)
- **`katana` binary** (optional, for fast URL discovery)
- **Docker** (optional, for Firecrawl/Maxun AGPL services)

---

## Install & Quick Start

```bash
git clone https://github.com/mananpa4/aio-scrap-crawl.git
cd aio-scrap-crawl

pnpm install
pnpm build

# Copy config (all variables have sensible defaults)
cp .env.example .env

# Scrape a single page — zero config, zero external deps
pnpm aio scrape https://example.com

# Scrape as CSV with markdown
pnpm aio scrape https://example.com --format csv --markdown

# Crawl a site (result auto-saved to ./output/)
pnpm aio crawl https://example.com --max-pages 30 --max-depth 2

# Use Crawlee for scalable crawling
pnpm aio crawl https://example.com --engine crawlee

# List all engines and availability
pnpm aio engines

# Run the offline demo (local server, no network needed)
pnpm example:crawl
```

---

## CLI Reference

### `aio scrape <url>`

Scrape a single URL.

```
Options:
  -e, --engine <name>   Engine: fetch|crawlee|firecrawl|katana|pyai  (default: $AIO_DEFAULT_ENGINE)
  -f, --format <fmt>    Output format: json|jsonl|csv                 (default: json)
  -o, --out <file>      Write to file instead of stdout
  --markdown            Request markdown output (engine permitting)
  --html                Include raw HTML in output
  --timeout <ms>        Request timeout in milliseconds
  --no-sanitize         Skip the WipeDown prompt-injection sanitizer
```

### `aio crawl <url>`

Crawl a site recursively. Output is auto-written to `./output/` unless `--out` is given.

```
Options:
  -e, --engine <name>   Engine to use
  -f, --format <fmt>    json|jsonl|csv
  -o, --out <file>      Explicit output path
  --max-pages <n>       Page cap              (default: $AIO_MAX_PAGES, 50)
  --max-depth <n>       Link depth            (default: $AIO_MAX_DEPTH, 2)
  --concurrency <n>     Parallel requests     (default: $AIO_CONCURRENCY, 5)
  --delay <ms>          Politeness delay per worker
  --all-origins         Follow cross-origin links
  --no-robots           Ignore robots.txt
  --no-sanitize         Skip sanitizer
```

### `aio engines`

Print all registered engines with their capabilities and current availability as JSON.

---

## Output Schema (`PageData`)

Every engine returns the same normalized record:

```jsonc
{
  "url": "https://example.com",
  "finalUrl": "https://example.com/",   // after redirects
  "statusCode": 200,
  "ok": true,
  "title": "Example Domain",
  "description": "An illustrative example.",
  "text": "...",                          // plain text
  "markdown": "...",                      // engines that support it
  "html": "...",                          // only when --html requested
  "links": ["https://example.com/more"],
  "images": [],
  "metadata": { "og:title": "...", "description": "..." },
  "structuredData": null,                 // schema/LLM extraction
  "fetchedAt": "2026-06-15T12:00:00.000Z",
  "engine": "fetch"
}
```

---

## Configuration

Copy `.env.example` to `.env`. All variables are optional — the AIO runs with only Node.js using its built-in engine.

| Variable | Default | Description |
|---|---|---|
| `AIO_DEFAULT_ENGINE` | `fetch` | Engine used when `--engine` is not set |
| `AIO_LOG_LEVEL` | `info` | `debug`\|`info`\|`warn`\|`error`\|`silent` |
| `AIO_LOG_JSON` | `false` | Emit JSON-line logs instead of pretty text |
| `AIO_OUTPUT_DIR` | `./output` | Directory for crawl result files |
| `AIO_USER_AGENT` | `aio-scrap-crawl/0.1` | Default User-Agent string |
| `AIO_MAX_PAGES` | `50` | Default crawl page cap |
| `AIO_MAX_DEPTH` | `2` | Default crawl depth |
| `AIO_CONCURRENCY` | `5` | Default concurrent requests |
| `AIO_DELAY_MS` | `0` | Default politeness delay (ms) |
| `AIO_RESPECT_ROBOTS` | `true` | Honour `robots.txt` |
| `AIO_SECURITY_SANITIZE` | `true` | Sanitize page content before output |
| `FIRECRAWL_API_URL` | — | URL of a running Firecrawl instance |
| `FIRECRAWL_API_KEY` | — | Firecrawl API key (if required) |
| `KATANA_BIN` | auto | Path to `katana` binary |
| `PYAI_URL` | `http://127.0.0.1:8099` | URL of the Python AI service |
| `WIPEDOWN_URL` | — | Dedicated WipeDown endpoint (falls back to `PYAI_URL`) |
| `OPENAI_API_KEY` | — | Used by `py-ai` service for LLM extraction |
| `ANTHROPIC_API_KEY` | — | Used by `py-ai` service |

---

## Project Structure

```
aio-scrap-crawl/
├── packages/
│   ├── core/           # @aio/core — contract, registry, config, exporters, FetchEngine
│   ├── crawler/        # @aio/crawler — CrawleeEngine (Crawlee, Apache-2.0)
│   ├── adapters/       # @aio/adapters — Firecrawl, Katana, PyAi adapters
│   └── ai/             # @aio/ai — LLM provider facade
├── modules/
│   └── security/       # @aio/security — WipeDown prompt-injection sanitizer
├── apps/
│   ├── cli/            # unified `aio` CLI (Commander.js)
│   ├── web/            # planned: no-code web UI
│   └── desktop/        # planned: Electron/Tauri desktop app
├── services/
│   └── py-ai/          # FastAPI service: Crawl4AI / ScrapeGraphAI / browser-use
├── scripts/
│   └── example-crawl.mjs  # offline 5-page demo
├── .env.example
├── docker-compose.yml
├── ARCHITECTURE.md     # full design document
├── MERGE_ANALYSIS.md   # analysis of the 10 source repos
├── MIGRATION_NOTES.md  # how each repo maps into the AIO
├── CHANGELOG.md
└── TODO.md             # pending work by area
```

---

## Development

```bash
pnpm install          # install all dependencies (473 packages)
pnpm build            # build all 6 packages (Turborepo)
pnpm typecheck        # TypeScript check across all packages (0 errors)
pnpm test             # run tests (Vitest, 14 tests, all offline)
pnpm test:watch       # watch mode
pnpm clean            # remove build artifacts
```

---

## Optional Services

### Python AI service

Provides Crawl4AI, ScrapeGraphAI, browser-use and WipeDown endpoints:

```bash
# Via Docker
docker compose up py-ai

# Or directly
cd services/py-ai
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8099
```

Set `PYAI_URL=http://127.0.0.1:8099` in `.env`, then use `--engine pyai`.

> The `/scrape`, `/extract` and `/sanitize` endpoints have working stubs.
> See `TODO(integration)` comments in `services/py-ai/app/main.py` to wire real libraries.

### Firecrawl (AGPL-3.0)

Run the upstream [Firecrawl](https://github.com/mendableai/firecrawl) compose, set `FIRECRAWL_API_URL`, then use `--engine firecrawl`.

---

## Adding a New Engine

1. Create a package implementing `ScrapeEngine` and/or `CrawlEngine` from `@aio/core`:
   - `name: string`
   - `capabilities: EngineCapabilities`
   - `isAvailable(): Promise<boolean>`
   - `scrape(job: ScrapeJob): Promise<PageData>`
   - `crawl(job: CrawlJob, onPage?: PageSink): Promise<CrawlResult>`
2. Map the engine's output to `PageData`.
3. Register it in `apps/cli/src/registry-factory.ts`.

The CLI, exporters and future API pick it up automatically.

---

## Security

Scraped content is an untrusted prompt-injection vector. `@aio/security` (inspired by WipeDown) strips hidden zero-width characters and common injection phrases from `text`/`markdown` before results are emitted or sent to any LLM. This runs by default; disable per-command with `--no-sanitize`.

---

## Roadmap

See [TODO.md](TODO.md) for the full list. Top priorities:

1. Wire `services/py-ai` endpoints (Crawl4AI, ScrapeGraphAI, browser-use)
2. `PlaywrightCrawler` variant in `@aio/crawler` for JS-rendered sites
3. `apps/api` — Fastify REST (`/scrape`, `/crawl`, `/search`, `/extract`, `/map`)
4. Job queue (BullMQ/Redis) for durable distributed crawls
5. SQLite/Postgres storage backends and Excel exporter
6. ESLint + Biome config, CI workflow, Dockerfile

---

## License

Core, packages, modules, apps and services: **MIT**.

Engine dependencies:
- [Crawlee](https://github.com/apify/crawlee) — Apache-2.0
- [Firecrawl](https://github.com/mendableai/firecrawl) — AGPL-3.0 (separate service, never vendored)
- [Maxun](https://github.com/getmaxun/maxun) — AGPL-3.0 (separate service, never vendored)

See [MIGRATION_NOTES.md](MIGRATION_NOTES.md) for full license analysis and isolation strategy.
