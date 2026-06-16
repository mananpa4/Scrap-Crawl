# services/py-ai

Python AI microservice for **aio-scrap-crawl**. It wraps the Python-native
scraping/AI engines and exposes them over HTTP so the TypeScript core can use
them through the `pyai` adapter.

## Engines wrapped (pending integration)

| Endpoint | Library | Purpose | License |
|----------|---------|---------|---------|
| `POST /scrape` | [Crawl4AI](../../MERGE_ANALYSIS.md) | scrape → clean Markdown + filtering | Apache-2.0 |
| `POST /extract` | ScrapeGraphAI | schema/prompt structured extraction | MIT |
| `POST /extract` (agent) | browser-use | agentic multi-step automation | MIT |
| `POST /sanitize` | WipeDown | prompt-injection sanitization | MIT |
| `GET /health` | — | liveness probe | — |

All endpoints return JSON shaped like the AIO `PageData` contract.

## Run (dev)

```bash
cd services/py-ai
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8099
```

Then point the core at it:

```env
PYAI_URL=http://127.0.0.1:8099
```

## Status

The endpoints are **scaffolded stubs** returning normalized empty results so the
whole AIO works end-to-end before the heavy engines are wired. Each handler in
`app/main.py` contains a `TODO(integration)` block with the exact call to make.
See the repo-level `TODO.md`.
