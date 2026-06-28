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

### Scrapling → `services/py-ai` `/scrape` + `packages/adapters/scrapling` (Adapter) `[added 2026-06-25]`
- **What moved:** the **stealth + adaptive scrape** capability — anti-bot fetching
  (Cloudflare Turnstile out of the box) and self-healing CSS selectors. Surfaced as
  a first-class engine `scrapling` via `ScraplingAdapter`, served by the py-ai
  process and selected with `engine: "scrapling"` on `/scrape`.
- **License:** BSD-3-Clause (permissive) — safe to integrate (unlike AGPL services).
  Runs as an *optional* Python lib inside py-ai, not vendored into the TS core.
- **Capabilities:** `scrape`, `javascript`, `structured` (crawl/markdown/agent off).
- **Pending:** wire the real `StealthyFetcher`/`Fetcher` calls in
  `services/py-ai/app/main.py` (`_scrape_scrapling`, TODO block present); optionally
  expose Scrapling's Spider framework as a crawl path and its native MCP server.

### MasterDnsVPN → (out of core, documented egress only) `[added 2026-06-25]`
- **What moved:** *nothing into the codebase.* MasterDnsVPN is a DNS-tunnelling
  transport for censored/harsh networks (MIT, Go) — **not** a scraper, parser or
  extractor. Forcing it in would be the "messy merge" the project explicitly avoids.
- **How it relates:** it can expose a local **SOCKS5** proxy; the crawler's egress
  could be pointed at it to reach censored/geo-blocked targets. Documented as an
  optional, out-of-band network option (`AIO_PROXY_URL`, commented in `.env.example`).
- **Pending:** wire `AIO_PROXY_URL` through the Crawlee engine's `proxyConfiguration`
  (honest TODO — not claimed as implemented). The decision to keep it out is about
  **relevance**, not license (MIT is permissive).

### 2captcha-python → `modules/captcha` + `services/py-ai` `/captcha/solve` (Integrated) `[added 2026-06-27]`
- **What moved:** the **captcha-solving role** as the primary provider. The official
  `twocaptcha` client (MIT) runs in py-ai; `@aio/captcha`'s `TwoCaptchaProvider`
  reaches it over `/captcha/solve`, keeping `TWOCAPTCHA_API_KEY` server-side.
- **Coverage:** recaptcha v2/v3, hcaptcha, turnstile, funcaptcha, geetest, image, text.
- **Status:** **real & verified** (live call to 2captcha.com; graceful error without a
  valid key). Needs a paid account to actually solve.
- **CLI:** `aio captcha <type> --url … --sitekey …`.

### ai-captcha-bypass → `modules/captcha` `AiVisionProvider` (Adapter, stub) `[added 2026-06-27]`
- **What moved:** the *concept* of a self-hosted LMM captcha solver (GPT-4o/Gemini
  vision), as the secondary, no-per-solve-fee provider. Its prompt/technique ideas
  inform the future implementation; its Selenium glue is **not** imported (the AIO
  standardizes on Playwright/CDP via browser-use).
- **Status:** stub — `/captcha/solve` with `provider: ai` returns `not-implemented`;
  `isAvailable()` is false until wired.

### captcha_bypass → reference only (NOT integrated) `[added 2026-06-27]`
- **Why out:** no license file (= all rights reserved, legally not reusable); bundles a
  GPL `.xpi` (Buster) and geckodriver binaries; Selenium/Firefox-specific. Only the
  *techniques* (B-spline human mouse movement, Buster audio challenge) are noted as ideas.

### challenge-bypass-extension (Privacy Pass) → out of scope (NOT integrated) `[added 2026-06-27]`
- **Why out:** it's a **deprecated** end-user browser extension implementing the Privacy
  Pass token protocol — interactive, not a programmatic solver usable in a headless
  pipeline. BSD-3 (fine) but irrelevant by design. Referenced as a concept only.

## Dependency decisions
- **Crawl engine:** chose **Crawlee** (Apache-2.0, TS-native) over vendoring
  Scrapy (Python/Twisted) for the core, keeping the control plane single-runtime.
- **AGPL isolation:** Firecrawl/Maxun consumed only over HTTP.
- **Heavy/AI deps** (torch, transformers, browsers, LLM SDKs) live in
  `services/py-ai`, optional and out of the core install.
- **Zero-dep fallback:** the built-in `FetchEngine` guarantees the AIO works with
  only Node installed.
