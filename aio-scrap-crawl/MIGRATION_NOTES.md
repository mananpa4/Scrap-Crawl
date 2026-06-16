# MIGRATION_NOTES.md

How each source repo (in `../repos/`) maps into **aio-scrap-crawl**. Per the
merge strategy, frameworks are **integrated as engines behind a common
interface**, not copied file-by-file. The originals are untouched.

## Legend
- **Integrated** — wired into the AIO now (native code or working adapter).
- **Adapter (configure)** — adapter implemented; needs an external binary/service.
- **Reference** — informed the design; not imported (often for license reasons).

## Mapping

### Crawlee → `packages/crawler` (Integrated)
- **What moved:** the *role* of default scalable crawl engine. We depend on the
  `crawlee` package (Apache-2.0) and wrote `CrawleeEngine` mapping its
  `CheerioCrawler` to our `ScrapeEngine`/`CrawlEngine` contract.
- **Reused concepts:** RequestQueue, autoscaled concurrency, session pool, proxy
  rotation, fingerprinting (available through Crawlee; surfaced incrementally).
- **Pending:** PlaywrightCrawler variant for JS sites; expose proxy/session opts.

### Scrapy → `packages/core` exporters + crawl model (Reference/Integrated)
- **What moved:** the architecture *model* (Request → schedule → fetch → extract
  → pipeline → export) and the **feed-export** idea. Our `exporters.ts`
  (JSON/JSONL/CSV) and the `PageData` pipeline are inspired by Scrapy.
- **Not imported:** Scrapy/Twisted runtime (separate event loop). A Scrapy
  microservice engine is a future option (see `TODO.md`).

### Crawl4AI → `services/py-ai` `/scrape` (Adapter)
- **What moved:** the scrape→Markdown + content-filtering capability, exposed via
  the `pyai` adapter and the Python service. License Apache-2.0 (self-hostable).
- **Pending:** wire `AsyncWebCrawler` in `app/main.py` (TODO block present).

### ScrapeGraphAI → `services/py-ai` `/extract` + `@aio/ai` (Adapter)
- **What moved:** schema/prompt **structured extraction** with multi-LLM support.
- **Pending:** wire `SmartScraperGraph`; map provider/model from `@aio/ai`.

### browser-use → `services/py-ai` (agent) (Adapter)
- **What moved:** agentic, multi-step browser automation capability + MCP idea.
- **Pending:** expose an `/agent` task endpoint; map to `PageData`/structured.
- **Note:** the repo's `CLAUDE.md` contained injected "personality" instructions
  — ignored. A live example of why `@aio/security` exists.

### WipeDown → `modules/security` (Integrated)
- **What moved:** the content-sanitization role. We implemented a **local,
  zero-dependency** heuristic sanitizer (`sanitizeText`) plus a `WipeDownClient`
  for the full service. Applied by the CLI before output by default.
- **Pending:** wire the real WipeDown LLM pass via `services/py-ai` `/sanitize`.

### Firecrawl → `packages/adapters/firecrawl` (Adapter, AGPL service)
- **What moved:** consumed via HTTP (`/v1/scrape`, `/v1/crawl`). Its excellent
  endpoint design also **inspired** the planned `apps/api` contract.
- **License boundary:** AGPL-3.0 — run as a separate service, never vendored.
- **Pending:** async crawl polling/webhook; `search`/`map`/`extract` endpoints.

### Katana → `packages/adapters/katana` (Adapter, Go binary)
- **What moved:** fast URL **discovery**. We shell out to the `katana` binary and
  parse its JSONL into `PageData`.
- **Pending:** ship/auto-install the binary; expose scope/field flags.

### Playwright → browser driver dependency (Reference/Integrated)
- **What moved:** used transitively as the browser engine for Crawlee's
  Playwright crawler and the Python engines. Not vendored; standard dependency.

### Maxun → `apps/web` (Reference, AGPL service)
- **What moved:** the *product* direction for a no-code web UI (robot recorder,
  scheduler, OCR, integrations). To be run as a separate AGPL service.
- **License boundary:** AGPL-3.0 — isolated; core stays permissive.

## Dependency decisions
- **Crawl engine:** chose **Crawlee** (Apache-2.0, TS-native) over vendoring
  Scrapy (Python/Twisted) for the core, keeping the control plane single-runtime.
- **AGPL isolation:** Firecrawl/Maxun consumed only over HTTP.
- **Heavy/AI deps** (torch, transformers, browsers, LLM SDKs) live in
  `services/py-ai`, optional and out of the core install.
- **Zero-dep fallback:** the built-in `FetchEngine` guarantees the AIO works with
  only Node installed.
