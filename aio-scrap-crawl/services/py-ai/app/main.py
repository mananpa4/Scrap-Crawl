"""
py-ai — the AIO's Python AI microservice.

It exposes a small HTTP API that the TypeScript core talks to via the `pyai`
adapter (packages/adapters/src/pyai.ts) and the `@aio/ai` module. The heavy
Python libraries live here because that is where they are native:

  - Crawl4AI          -> scrape -> clean Markdown + content filtering
  - ScrapeGraphAI     -> schema/prompt structured extraction (multi-LLM)
  - browser-use       -> agentic, multi-step browser automation
  - WipeDown          -> prompt-injection sanitization

Every endpoint returns JSON shaped like the AIO `PageData` so the TypeScript
side needs no remapping.

Run:  uvicorn app.main:app --host 0.0.0.0 --port 8099
"""
from __future__ import annotations

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


class ExtractIn(BaseModel):
    url: str
    schema: Any | None = None
    prompt: str | None = None
    provider: str = "openai"
    model: str = "gpt-4o-mini"


class SanitizeIn(BaseModel):
    content: str
    source: str | None = None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "py-ai", "version": "0.1.0"}


@app.post("/scrape")
def scrape(body: ScrapeIn) -> dict[str, Any]:
    """
    TODO(integration): call Crawl4AI here, e.g.

        from crawl4ai import AsyncWebCrawler
        async with AsyncWebCrawler() as crawler:
            result = await crawler.arun(url=body.url)
        return {..., "markdown": result.markdown, "links": result.links, ...}

    Until wired, return a normalized empty page so callers degrade gracefully.
    """
    page = _empty_page(body.url, "crawl4ai", error="not-implemented")
    return page


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
