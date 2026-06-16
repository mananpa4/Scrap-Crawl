# Changelog

All notable changes to **aio-scrap-crawl** are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/); versioning is
[SemVer](https://semver.org/).

## [0.1.0] — 2026-06-15

Initial AIO scaffold produced by the intelligent merge of 10 source repos.

### Added
- **Monorepo** (pnpm + Turborepo, TypeScript): `packages/*`, `modules/*`,
  `apps/cli`, `services/py-ai`.
- **`@aio/core`** — shared contract: `ScrapeJob`/`CrawlJob`/`PageData` model,
  `ScrapeEngine`/`CrawlEngine` interfaces, `EngineRegistry`, centralized config
  (dotenv + zod), zero-dep logger, URL normalization + dedupe, basic robots.txt,
  JSON/JSONL/CSV exporters, and a built-in zero-dependency **FetchEngine**
  (scrape + recursive crawl with depth, concurrency, robots and same-origin).
- **`@aio/crawler`** — `CrawleeEngine` (Crawlee `CheerioCrawler`) mapped to the
  common contract.
- **`@aio/adapters`** — `FirecrawlAdapter` (HTTP, AGPL service), `KatanaAdapter`
  (Go binary), `PyAiAdapter` (Python AI service), all behind the same interface
  with graceful `isAvailable()` degradation.
- **`@aio/security`** — WipeDown-style local prompt-injection sanitizer +
  service client; applied by the CLI before output by default.
- **`@aio/ai`** — provider-agnostic facade over the py-ai service.
- **`apps/cli`** — unified `aio` CLI: `scrape`, `crawl`, `engines`.
- **`services/py-ai`** — FastAPI skeleton (`/health`, `/scrape`, `/extract`,
  `/sanitize`) for Crawl4AI / ScrapeGraphAI / browser-use / WipeDown.
- **Docs:** `MERGE_ANALYSIS.md`, `ARCHITECTURE.md`, `MIGRATION_NOTES.md`,
  `TODO.md`, `README.md`; `.env.example`, `docker-compose.yml`, config example.
- **Tests:** offline E2E for the FetchEngine and CrawleeEngine (local server),
  exporters, URL utils, HTML extraction and the sanitizer.

### Notes
- Firecrawl and Maxun (AGPL-3.0) are integrated only as isolated network
  services; the core and adapters remain permissively licensed.
- AI/Go engines are optional; the core runs with Node alone.
