# Changelog

All notable changes to **aio-scrap-crawl** are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/); versioning is
[SemVer](https://semver.org/).

## [Unreleased]

### Added
- **Play Store module** (`@aio/core` `playstore.ts`, zero-dep): `fetchPlaystoreApp`,
  `parsePlaystoreHtml`, `sizeImageUrl`. Given an Android package id, returns the app's
  title, developer, version and `play-lh.googleusercontent.com` icon + screenshot URLs.
  Exposed on the CLI as `aio playstore <package> [--hl --gl]` (JSON). Consumed by
  `dowdes-appvault` to link app images instead of storing local copies. Tests in
  `packages/core/test/playstore.test.ts`.
- **APK source resolver** (`@aio/core` `apksource.ts`, zero-dep): `resolveApk` picks
  a mirror site (apkpure / uptodown / apkmirror) at random with fallback and returns a
  validated direct download URL (`probeUrl` follows redirects without downloading the
  body). Needs no Google auth. CLI: `aio apksource <package> [--site random|apkpure|
  uptodown|apkmirror] [--json]`. Powers the `dowdes-appvault` "live download" mirror
  source. Tests in `packages/core/test/apksource.test.ts`.

## [0.2.0] — 2026-06-25

Folded **two newly added source repos** into the AIO (total now **12**),
following the existing engine/adapter pattern. No original repo was modified.

### Added
- **`scrapling` engine** — stealth/adaptive Python scraper (BSD-3-Clause): anti-bot
  fetching (Cloudflare Turnstile out of the box) and self-healing CSS selectors.
  **Fully wired (live, not a stub).**
  - `ScraplingAdapter` in `@aio/adapters` (`packages/adapters/src/scrapling.ts`),
    registered in the CLI; usable via `aio scrape --engine scrapling` and listed by
    `aio engines` (capabilities: scrape, javascript, structured).
  - `services/py-ai` `/scrape` routes by `engine` (`crawl4ai` | `scrapling`).
    `_scrape_scrapling` calls Scrapling for real: `StealthyFetcher` when
    `stealth=true`, HTTP `Fetcher` otherwise, with a graceful browser→HTTP fallback
    that records the reason in `metadata["scrapling.stealth_error"]`. Output mapped
    to `PageData` (title, text, links, images, status, og/meta).
  - Shares the py-ai process/`PYAI_URL` with the Crawl4AI-backed `pyai` engine.
  - Install: `pip install 'scrapling[fetchers]'` (HTTP) + `scrapling install` (stealth browser).

### Added — captcha-solving layer (`@aio/captcha`)
- New module `modules/captcha` with a provider-agnostic `CaptchaSolver` interface
  (`CaptchaChallenge` → `CaptchaSolution`) and two providers:
  - **`2captcha`** (`TwoCaptchaProvider`) — **real**, wraps the MIT `twocaptcha`
    client in py-ai (`/captcha/solve`, `/captcha/health`). Covers recaptcha v2/v3,
    hcaptcha, turnstile, funcaptcha, geetest, image, text. `TWOCAPTCHA_API_KEY` stays
    server-side. Verified end-to-end (CLI → adapter → py-ai → live 2captcha.com call;
    graceful `{ok:false}` without a valid key).
  - **`ai-vision`** (`AiVisionProvider`) — documented stub for a self-hosted LMM solver
    (GPT-4o/Gemini), inspired by `ai-captcha-bypass`. `not-implemented` until wired.
- CLI: `aio captcha <type> --url … --sitekey …` (provider via `-p`/`AIO_CAPTCHA_PROVIDER`).
- `.env.example`: `TWOCAPTCHA_API_KEY`, `GEMINI_API_KEY`, `AIO_CAPTCHA_PROVIDER`;
  `2captcha-python` added (commented) to `requirements.txt`.
- Analyzed `repos-captch/` (4 repos): `captcha_bypass` (no license) and Privacy Pass
  extension (deprecated) kept as reference only — not integrated.

### Documented (no code in core)
- **MasterDnsVPN** (MIT, Go) recognized as a DNS-tunnelling **network egress**, not
  a scraper. Kept out of the core; documented as an optional out-of-band SOCKS5
  proxy (`AIO_PROXY_URL`, commented in `.env.example`). Crawlee proxy wiring tracked
  in `TODO.md`.

### Changed
- `MERGE_ANALYSIS.md` expanded to 12 repos (new §2.11 Scrapling, §2.12 MasterDnsVPN,
  updated dedup/architecture tables); `MIGRATION_NOTES.md`, `TODO.md`, `README.md`
  and `.env.example` updated for the new engine and egress option.

### Verified
- `pnpm build`, `pnpm typecheck` (11 tasks), `pnpm test` (all suites green);
  `python -m py_compile` clean on the updated service.
- **Real end-to-end (live):** installed `scrapling[fetchers]` (0.4.9) + FastAPI,
  started `services/py-ai`, and ran `aio scrape https://example.com --engine
  scrapling` through CLI → adapter → service → real Scrapling, getting a real
  `PageData` (title/text/links/status). `aio engines` shows `scrapling:
  available: true` while the service runs.
- **Stealth note:** the `StealthyFetcher` (browser) path is wired and attempts the
  real browser; in the sandboxed build env the browser could not spawn
  (`spawn UNKNOWN`), so it fell back to the HTTP `Fetcher` as designed. On a host
  that can launch the browser, `stealth=true` uses the real stealth fetcher.

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
