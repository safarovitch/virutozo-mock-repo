# apps/gateway — local guide

**Purpose:** same-origin gateway (ADR-0005): shell, `/remotes/<name>/`, `/remotes.json`, and a proxy for `/api` (incl. WebSocket).

**Framework and key libraries:** Fastify 5, `@fastify/static`, `@fastify/http-proxy`, Zod 4 for config. Plain ESM JavaScript with JSDoc, type-checked by `tsc --checkJs`.

**Owns:** the resolution order (SPEC.md §2.2), the production CSP (generated from `config/remotes.gateway.json`), `FAIL_REMOTES` and `/__test/fail-remotes`.

**Local commands:** `NIMBUS_MODE=e2e node apps/gateway/src/main.mjs` · `pnpm nx run gateway:test` · `PORT=8090 …` when 8080 is busy.

**Local pitfalls**
- `NIMBUS_MODE` is required; never read `NODE_ENV`.
- A missing file under `/remotes/` must stay a 404, never `index.html`.
- Test endpoints exist only in `dev` and `e2e` modes; add a test for any new one.
