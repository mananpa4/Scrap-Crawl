# config/

Configuration for **aio-scrap-crawl** is centralized and resolved by
`packages/core/src/config.ts` in this order (later wins):

1. Built-in defaults (in `config.ts`).
2. `.env` at the repo root (copy from `.env.example`).
3. Real environment variables.
4. CLI flags (per command, e.g. `--max-pages`, `--engine`).

`aio.config.example.json` documents the same settings as a single object for
reference and for future file-based config support (see `TODO.md`). The runtime
currently reads `.env` / environment variables, not this JSON.
