# TODO.md

Pending work, grouped by area. Items marked **(broken-but-valuable)** are wired
as stubs/adapters that need an external piece to fully function — documented so
nothing is silently missing.

## Engines
- [ ] **Crawlee:** add a `PlaywrightCrawler` variant for JS-rendered sites
      (capability `javascript: true`); surface proxy/session/fingerprint options.
- [ ] **firecrawl** (broken-but-valuable): implement async crawl polling/webhook;
      add `search`, `map`, `extract` endpoints; verify `/v1` response shapes.
- [ ] **katana** (broken-but-valuable): ship/auto-install the Go binary; expose
      scope (`-field-scope`), filters and `-headless` flag; respect `maxPages`
      cleanly (graceful kill).
- [ ] **pyai** (broken-but-valuable): wire Crawl4AI (`/scrape`), ScrapeGraphAI
      (`/extract`), browser-use (`/agent`) in `services/py-ai/app/main.py`
      (TODO blocks present). Return real `PageData`.
- [ ] **scrapy:** optional engine via a Python microservice for heavy pipelines
      + native feed exports.

## Core
- [ ] File-based config (`config/aio.config.json`) layered with `.env`.
- [ ] Pluggable storage backends (SQLite/Postgres/MySQL) beyond file exports.
- [ ] Job queue (BullMQ/Redis) for durable, distributed crawls.
- [ ] Sitemap (`sitemap.xml`) ingestion utility (Scrapy/Katana have references).
- [ ] Richer robots.txt (crawl-delay, sitemaps, RFC 9309 edge cases).
- [ ] Excel export (`xlsx`) and DB exporters.
- [ ] Proxy/User-Agent rotation surfaced at the core level (Crawlee-backed).

## Security
- [ ] Wire real WipeDown LLM sanitization via `services/py-ai` `/sanitize`.
- [ ] Expand injection signature set; add allow/deny domain policy.

## Modules
- [ ] `@aio/ai`: provider abstraction beyond the py-ai passthrough (token costs,
      retries, streaming).
- [ ] Domain modules requested in the brief (social, ecommerce, news, seo,
      files, images, video): add as thin extractors on top of `PageData` once a
      first real site target exists. (Not invented prematurely.)

## Apps
- [ ] **apps/api:** Fastify REST over `@aio/core` (contract inspired by
      Firecrawl: `/scrape`, `/crawl`, `/search`, `/extract`, `/map`).
- [ ] **apps/web:** Maxun (AGPL, isolated service) OR own front over `apps/api`.
- [ ] **apps/desktop:** Electron/Tauri wrapping web + CLI.

## Quality / tooling
- [ ] ESLint + Biome config across the monorepo.
- [ ] CI (build + typecheck + test) workflow.
- [ ] More tests: adapters (mocked HTTP), CLI integration, robots parser.
- [ ] Dockerfile for the CLI/core image.
