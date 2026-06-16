# apps/web (placeholder)

The web app is **planned**, not yet implemented. Two approved paths (see
`ARCHITECTURE.md` §7 and the project decisions):

1. **Maxun-based (AGPL, isolated).** Run [Maxun](../../../repos/maxun-develop)
   as a separate AGPL service (its own Docker + Postgres) and integrate it via
   its API/MCP. Maximum features (no-code robot recorder, scheduler, OCR,
   integrations) with zero AGPL contamination of the permissive core.

2. **Own front over the AIO API.** Build a React/Next front that talks to the
   future `apps/api` (REST), reusing `@aio/core`. Fully permissive.

This directory is intentionally empty except for this note so it is not part of
the build graph yet. See `TODO.md` → "apps/web".
