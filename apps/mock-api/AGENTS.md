# apps/mock-api — local guide

**Purpose:** the mock backend (TECH-3): every operation in `contracts/openapi.yaml` under `/api`, the WebSocket `/api/events`, and `/api/__test/*` endpoints. Data and behaviour: `specs/mock-data.md`.

**Framework and key libraries:** Fastify 5, `@fastify/websocket` 11, Zod 4 (generated schemas from `@nimbus/api-client/zod`), TypeScript run with `tsx`.

**Owns:** the seed (`db.ts`, deterministic with `MOCK_SEED`), sessions, RBAC scope, the task runner, the event hub (RT-12 scoping, close codes).

**Local commands:** `NIMBUS_MODE=e2e pnpm --filter @nimbus/mock-api start` · `pnpm nx run mock-api:test` · `pnpm e2e:stack` (with the gateway).

**Local pitfalls**
- Never hand-write request or response shapes: validate with the generated Zod schemas, and keep the test helper's contract check on every response.
- Permissions come from `x-permission` in `openapi.yaml`; the role matrix in `rbac.ts` follows `specs/shared/rbac.md`.
- Test endpoints exist only when `NIMBUS_MODE` is `dev` or `e2e`; never read `NODE_ENV`.
- Integration tests run with `timeScale: 0.01`; keep one real-time test for task durations.
- Buckets of tenants other than acme are generated on first list (`db.bucketsOf`, D8-04); read buckets through it, never `db.buckets` directly, or other tenants look empty.
