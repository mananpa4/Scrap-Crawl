"""
py-ai — the AIO's Python AI microservice.

It exposes a small HTTP API that the TypeScript core talks to via the `pyai`
and `scrapling` adapters (packages/adapters/src/*.ts) and the `@aio/ai` module.
The heavy Python libraries live here because that is where they are native:

  - Crawl4AI          -> scrape -> clean Markdown + content filtering
  - Scrapling         -> stealth/adaptive scrape (anti-bot, self-healing CSS)
  - ScrapeGraphAI     -> schema/prompt structured extraction (multi-LLM)
  - browser-use       -> agentic, multi-step browser automation
  - WipeDown          -> prompt-injection sanitization

Every endpoint returns JSON shaped like the AIO `PageData` so the TypeScript
side needs no remapping.

Run:  uvicorn app.main:app --host 0.0.0.0 --port 8099
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="aio py-ai", version="0.1.0")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _empty_page(url: str, engine: str, error: str | None = None) -> dict[str, Any]:
    return {
        "url": url,
        "ok": error is None,
        "links": [],
        "images": [],
        "metadata": {},
        "fetchedAt": _now(),
        "engine": engine,
        "error": error,
    }


class ScrapeIn(BaseModel):
    url: str
    formats: list[str] = ["markdown", "text"]
    extract: dict[str, Any] | None = None
    # Which Python scrape engine to route to: "crawl4ai" | "scrapling".
    engine: str = "crawl4ai"
    # Scrapling-only knobs (ignored by other engines).
    stealth: bool = True
    adaptive: bool = False


class ExtractIn(BaseModel):
    url: str
    schema: Any | None = None
    prompt: str | None = None
    provider: str = "openai"
    model: str = "gpt-4o-mini"


class SanitizeIn(BaseModel):
    content: str
    source: str | None = None


class CaptchaIn(BaseModel):
    # recaptcha-v2 | recaptcha-v3 | hcaptcha | turnstile | funcaptcha | geetest | image | text
    type: str
    provider: str = "2captcha"  # "2captcha" | "ai-vision"
    url: str | None = None
    sitekey: str | None = None
    image: str | None = None  # base64 or file path (image captcha)
    text: str | None = None  # question (text captcha)
    action: str | None = None  # recaptcha v3
    minScore: float | None = None  # recaptcha v3
    enterprise: bool = False
    extra: dict[str, Any] = {}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "py-ai", "version": "0.1.0"}


@app.post("/scrape")
def scrape(body: ScrapeIn) -> dict[str, Any]:
    """Route a single-page scrape to the requested Python engine.

    Both engines currently return a normalized empty page so TypeScript callers
    degrade gracefully until the heavy libraries are installed and wired (see the
    per-engine TODO blocks below and services/py-ai/requirements.txt).
    """
    if body.engine == "scrapling":
        return _scrape_scrapling(body)
    return _scrape_crawl4ai(body)


def _scrape_crawl4ai(body: ScrapeIn) -> dict[str, Any]:
    """
    TODO(integration): call Crawl4AI here, e.g.

        from crawl4ai import AsyncWebCrawler
        async with AsyncWebCrawler() as crawler:
            result = await crawler.arun(url=body.url)
        return {..., "markdown": result.markdown, "links": result.links, ...}
    """
    return _empty_page(body.url, "crawl4ai", error="not-implemented")


def _scrape_scrapling(body: ScrapeIn) -> dict[str, Any]:
    """
    Scrapling (BSD-3-Clause) — adaptive, anti-bot scraping. Its differentiators
    over Crawl4AI are stealth fetching (Cloudflare Turnstile out of the box) and
    self-healing CSS selectors that survive page redesigns.

    `stealth=True` uses the browser-based StealthyFetcher (needs a browser from
    `scrapling install`); if that is missing/fails we fall back to the plain HTTP
    Fetcher so the engine still returns a real page instead of crashing.
    """
    try:
        # The HTTP Fetcher only needs scrapling[fetchers] (curl_cffi); it must not
        # depend on the browser stack, so StealthyFetcher is imported separately.
        from scrapling.fetchers import Fetcher
    except ImportError:
        return _empty_page(
            body.url, "scrapling",
            error="scrapling-fetchers-not-installed (pip install 'scrapling[fetchers]')",
        )

    page = None
    fetcher_label = "fetcher"
    stealth_error: str | None = None

    if body.stealth:
        try:
            from scrapling.fetchers import StealthyFetcher

            page = StealthyFetcher.fetch(body.url, headless=True, network_idle=True)
            fetcher_label = "stealthy"
        except Exception as exc:  # browser not installed (run `scrapling install`), timeout, etc.
            stealth_error = f"{type(exc).__name__}: {exc}"

    if page is None:
        try:
            page = Fetcher.get(body.url)
            fetcher_label = "fetcher(fallback)" if body.stealth else "fetcher"
        except Exception as exc:
            return _empty_page(body.url, "scrapling", error=f"fetch-failed: {exc}")

    return _scrapling_to_page(body, page, fetcher_label, stealth_error)


def _scrapling_to_page(
    body: ScrapeIn, page: Any, fetcher_label: str, stealth_error: str | None
) -> dict[str, Any]:
    def attrs(selector: str, attr: str) -> list[str]:
        out: list[str] = []
        try:
            for el in page.css(selector):
                val = el.attrib.get(attr)
                if val:
                    try:
                        out.append(page.urljoin(val))
                    except Exception:
                        out.append(val)
        except Exception:
            pass
        return _dedupe(out)

    def first_text(selector: str) -> str | None:
        try:
            val = page.css(selector).get()
            return str(val).strip() if val else None
        except Exception:
            return None

    def meta(name: str) -> str | None:
        for sel in (f'meta[name="{name}"]', f'meta[property="{name}"]'):
            try:
                nodes = page.css(sel)
                if nodes:
                    val = nodes[0].attrib.get("content")
                    if val:
                        return val
            except Exception:
                continue
        return None

    status = getattr(page, "status", 200)
    metadata: dict[str, str] = {"scrapling.fetcher": fetcher_label}
    if stealth_error:
        metadata["scrapling.stealth_error"] = stealth_error
    for key in ("description", "og:title", "og:description", "og:image"):
        val = meta(key)
        if val:
            metadata[key] = val

    result: dict[str, Any] = {
        "url": str(getattr(page, "url", body.url)),
        "ok": status < 400,
        "statusCode": status,
        "title": first_text("title::text"),
        "description": meta("description"),
        "links": attrs("a[href]", "href"),
        "images": attrs("img[src]", "src"),
        "metadata": metadata,
        "fetchedAt": _now(),
        "engine": "scrapling",
    }
    if "text" in body.formats or not body.formats:
        try:
            result["text"] = str(page.get_all_text())
        except Exception:
            pass
    if "html" in body.formats:
        try:
            result["html"] = str(page.html_content)
        except Exception:
            pass
    return result


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for it in items:
        if it not in seen:
            seen.add(it)
            out.append(it)
    return out


@app.post("/extract")
def extract(body: ExtractIn) -> dict[str, Any]:
    """
    TODO(integration): call ScrapeGraphAI (SmartScraperGraph) with `body.schema`
    / `body.prompt` and `body.provider`/`body.model`, returning structuredData.
    """
    return {
        "url": body.url,
        "structuredData": None,
        "page": _empty_page(body.url, "scrapegraphai", error="not-implemented"),
    }


@app.post("/sanitize")
def sanitize(body: SanitizeIn) -> dict[str, Any]:
    """
    TODO(integration): call WipeDown to neutralize prompt injection, e.g.

        from wipedown import WipeDown
        firewall = WipeDown()
        result = firewall.wipe_text(body.content)
        return {"status": result["status"], "content": result["content"],
                "metadata": result["metadata"]}

    Until wired, echo content back unchanged with an explicit marker so callers
    know server-side sanitization is a no-op (the TS-side local sanitizer still
    runs as a fallback).
    """
    return {
        "status": "success",
        "source": body.source,
        "content": body.content,
        "metadata": {"timestamp": _now(), "sanitization_events": [], "note": "stub"},
    }


# --- Captcha-solving layer ---------------------------------------------------
# Providers wrap real solving backends. `2captcha` is a thin client to the
# 2captcha.com commercial service (real). `ai-vision` is a documented stub for a
# self-hosted LMM solver. The TS `@aio/captcha` providers reach these endpoints.

_TOKEN_CAPTCHAS = {
    "recaptcha-v2", "recaptcha-v3", "hcaptcha", "turnstile", "funcaptcha", "geetest",
}


def _twocaptcha_status() -> dict[str, Any]:
    try:
        import twocaptcha  # noqa: F401
    except ImportError:
        return {"ready": False, "reason": "2captcha-python not installed"}
    if not os.environ.get("TWOCAPTCHA_API_KEY"):
        return {"ready": False, "reason": "TWOCAPTCHA_API_KEY not set"}
    return {"ready": True, "reason": None}


def _ai_vision_status() -> dict[str, Any]:
    # Stub solver — never "ready" until the LMM vision path is implemented.
    return {"ready": False, "reason": "ai-vision solver not implemented yet (stub)"}


@app.get("/captcha/health")
def captcha_health() -> dict[str, Any]:
    return {
        "providers": {
            "2captcha": _twocaptcha_status(),
            "ai-vision": _ai_vision_status(),
        }
    }


@app.post("/captcha/solve")
def captcha_solve(body: CaptchaIn) -> dict[str, Any]:
    if body.provider in ("ai", "ai-vision"):
        return _solve_ai_vision(body)
    return _solve_2captcha(body)


def _captcha_error(body: CaptchaIn, provider: str, error: str) -> dict[str, Any]:
    return {"ok": False, "type": body.type, "provider": provider, "error": error}


def _solve_2captcha(body: CaptchaIn) -> dict[str, Any]:
    """Solve via the 2Captcha commercial service (real)."""
    try:
        from twocaptcha import TwoCaptcha
    except ImportError:
        return _captcha_error(
            body, "2captcha",
            "2captcha-python not installed (pip install 2captcha-python)",
        )

    api_key = os.environ.get("TWOCAPTCHA_API_KEY")
    if not api_key:
        return _captcha_error(body, "2captcha", "TWOCAPTCHA_API_KEY not set")

    solver = TwoCaptcha(api_key)
    t = body.type
    try:
        if t == "recaptcha-v2":
            extra = {"enterprise": 1} if body.enterprise else {}
            res = solver.recaptcha(sitekey=body.sitekey, url=body.url, **extra)
        elif t == "recaptcha-v3":
            res = solver.recaptcha(
                sitekey=body.sitekey, url=body.url, version="v3",
                action=body.action or "verify", score=body.minScore or 0.4,
                enterprise=1 if body.enterprise else 0,
            )
        elif t == "hcaptcha":
            res = solver.hcaptcha(sitekey=body.sitekey, url=body.url)
        elif t == "turnstile":
            res = solver.turnstile(sitekey=body.sitekey, url=body.url)
        elif t == "funcaptcha":
            res = solver.funcaptcha(sitekey=body.sitekey, url=body.url)
        elif t == "geetest":
            res = solver.geetest(
                gt=body.extra.get("gt"), challenge=body.extra.get("challenge"),
                url=body.url,
            )
        elif t == "image":
            res = solver.normal(body.image)
        elif t == "text":
            res = solver.text(body.text)
        else:
            return _captcha_error(body, "2captcha", f"unsupported captcha type '{t}'")
    except Exception as exc:  # network/timeout/validation/api errors
        return _captcha_error(body, "2captcha", f"{type(exc).__name__}: {exc}")

    code = res.get("code") if isinstance(res, dict) else res
    out: dict[str, Any] = {
        "ok": True,
        "type": t,
        "provider": "2captcha",
        "id": res.get("captchaId") if isinstance(res, dict) else None,
    }
    if t in _TOKEN_CAPTCHAS:
        out["token"] = code
    else:
        out["text"] = code
    return out


def _solve_ai_vision(body: CaptchaIn) -> dict[str, Any]:
    """
    Self-hosted LMM captcha solver (GPT-4o / Gemini vision), inspired by the
    `ai-captcha-bypass` repo and driven through @aio/ai + browser-use.

    TODO(integration): screenshot/extract the challenge, send it to a multimodal
    model, and return the click coordinates / text / token. Until wired, return a
    clear not-implemented marker so callers fall back to the 2captcha provider.
    """
    return _captcha_error(body, "ai-vision", "not-implemented")
