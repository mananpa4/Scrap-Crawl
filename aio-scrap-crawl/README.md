# aio-scrap-crawl

**All-In-One scraping and crawling orchestration platform** — one TypeScript core, one CLI, one output schema, over the best open-source engines.

> Built by intelligently merging 12 projects: Crawlee, Crawl4AI, ScrapeGraphAI, Firecrawl, Katana, browser-use, Playwright, Scrapy, WipeDown, Maxun, Scrapling and MasterDnsVPN. Plus a **captcha-solving layer** (`@aio/captcha`: 2Captcha + AI-vision).

---

## Why this exists

These tools can't be naively fused — they span 3 languages, carry incompatible runtimes, and two are AGPL-3.0. The solution: a **TypeScript orchestration core** that exposes every tool as a pluggable **engine** behind a shared interface. Switching from the built-in HTTP engine to Crawlee or Firecrawl is one string. The job model, output schema and exporters never change.

```
ScrapeJob / CrawlJob  ──►  [ engine ]  ──►  PageData  ──►  JSON / JSONL / CSV
                              ▲
   fetch · crawlee · firecrawl · katana · pyai · scrapling
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
| `scrapling` | `@aio/adapters` | `PYAI_URL` service | ✅ | — | ✅ | — | ✅ | — |

Engines that are not configured report `available: false` and fail with a clear error instead of crashing.

> **`scrapling`** is the stealth/adaptive Python engine (anti-bot fetching that
> clears Cloudflare Turnstile, plus self-healing CSS selectors). It runs inside
> the same `services/py-ai` process as `pyai`, so configuring `PYAI_URL` enables both.

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
  -e, --engine <name>   Engine: fetch|crawlee|firecrawl|katana|pyai|scrapling  (default: $AIO_DEFAULT_ENGINE)
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

### `aio captcha <type>`

Solve a captcha via a provider and print the solution (token/answer) as JSON. Served
by the py-ai service (where the solving libraries live). **Use only on sites you are
authorized to test** — captcha solving bypasses bot defenses and often violates ToS.

```
Arguments:
  type                  recaptcha-v2|recaptcha-v3|hcaptcha|turnstile|funcaptcha|geetest|image|text

Options:
  -p, --provider <name> 2captcha | ai-vision        (default: $AIO_CAPTCHA_PROVIDER or 2captcha)
  --url <url>           page URL (token captchas)
  --sitekey <key>       site key (token captchas)
  --image <file>        image file path (image captcha)
  --text <q>            question text (text captcha)
  --action <a>          reCAPTCHA v3 action
  --min-score <n>       reCAPTCHA v3 minimum score
  --enterprise          reCAPTCHA enterprise
```

Providers: **`2captcha`** (commercial service, real — needs `TWOCAPTCHA_API_KEY`) and
**`ai-vision`** (self-hosted LMM solver, currently a stub). Both report
`available: false` until configured.

```bash
# Example (requires a paid 2Captcha key set in services/py-ai env)
pnpm aio captcha turnstile --url https://example.com --sitekey 0x4AA...
```

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
│   ├── adapters/       # @aio/adapters — Firecrawl, Katana, PyAi, Scrapling adapters
│   └── ai/             # @aio/ai — LLM provider facade
├── modules/
│   ├── security/       # @aio/security — WipeDown prompt-injection sanitizer
│   └── captcha/        # @aio/captcha — CaptchaSolver: 2captcha + ai-vision providers
├── apps/
│   ├── cli/            # unified `aio` CLI (Commander.js)
│   ├── web/            # planned: no-code web UI
│   └── desktop/        # planned: Electron/Tauri desktop app
├── services/
│   └── py-ai/          # FastAPI service: Crawl4AI / Scrapling / ScrapeGraphAI / browser-use
├── scripts/
│   └── example-crawl.mjs  # offline 5-page demo
├── .env.example
├── docker-compose.yml
├── ARCHITECTURE.md     # full design document
├── MERGE_ANALYSIS.md   # analysis of the 12 source repos
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

Provides Crawl4AI, Scrapling, ScrapeGraphAI, browser-use and WipeDown endpoints:

```bash
# Via Docker
docker compose up py-ai

# Or directly
cd services/py-ai
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8099
```

Set `PYAI_URL=http://127.0.0.1:8099` in `.env`, then use `--engine pyai` or
`--engine scrapling` (both are served by this process).

> **`scrapling` is fully wired** (live, not a stub). Install it with
> `pip install 'scrapling[fetchers]'` for the HTTP fetcher; add `scrapling install`
> to enable the browser-based stealth fetcher. With `stealth=true` it uses the real
> `StealthyFetcher` and transparently falls back to the HTTP `Fetcher` if a browser
> can't launch (the reason is recorded under `metadata["scrapling.stealth_error"]`).
>
> The `pyai` (Crawl4AI) `/scrape`, plus `/extract` and `/sanitize`, are still stubs —
> see the `TODO(integration)` comments in `services/py-ai/app/main.py`.

### Firecrawl (AGPL-3.0)

Run the upstream [Firecrawl](https://github.com/mendableai/firecrawl) compose, set `FIRECRAWL_API_URL`, then use `--engine firecrawl`.

### MasterDnsVPN — optional network egress (not an engine)

[MasterDnsVPN](https://github.com/masterking32/MasterDnsVPN) (MIT, Go) is a
DNS-tunnelling transport for harsh/censored networks, **not** a scraper. It is
intentionally **outside the AIO core**. If you run its client it exposes a local
SOCKS5 proxy you can route crawls through to reach censored or geo-blocked
targets. Run it separately (`repos/MasterDnsVPN-main`) and point a proxy at its
SOCKS5 listener. Wiring this through the Crawlee engine's proxy configuration is
a documented [TODO](TODO.md).

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
- [Scrapling](https://github.com/D4Vinci/Scrapling) — BSD-3-Clause (optional Python lib in `services/py-ai`)
- [MasterDnsVPN](https://github.com/masterking32/MasterDnsVPN) — MIT (optional out-of-band SOCKS5 egress, not vendored)
- [2captcha-python](https://github.com/2captcha/2captcha-python) — MIT (optional captcha solver client in `services/py-ai`)
- [Firecrawl](https://github.com/mendableai/firecrawl) — AGPL-3.0 (separate service, never vendored)
- [Maxun](https://github.com/getmaxun/maxun) — AGPL-3.0 (separate service, never vendored)

See [MIGRATION_NOTES.md](MIGRATION_NOTES.md) for full license analysis and isolation strategy.
