# Day 2 prompt — Contract, generated clients, mock API

> Run after Day 1 is merged with green CI. Paste everything below the line into your agent.

---

Milestone **Day 2** from `SPEC.md` §14: make the API contract real end to end.

## Read first
`AGENTS.md`, `contracts/main.tsp`, `specs/mock-data.md`, SPEC.md §5 (RBAC), §6 (API) and §9 (Messages & formatting), and `docs/adr/ADR-0005-same-origin-gateway-and-cookie-session.md`. Reply with your plan and any gaps or contradictions you find in these files, then wait for "go".

## Scope
1. **Contract package.** `contracts/` is already a pnpm workspace package (Day 1). Make it an Nx project (`contracts`) with targets:
   - `contract:build` → `tsp compile .` then copy the emitted file to `contracts/openapi.yaml`.
   - `contract:lint` → `redocly lint openapi.yaml` (must pass with 0 errors).
   - Root scripts `pnpm contract:build`, `pnpm api:generate`.
   Do **not** change the contract's meaning. If you think it needs a change, list it in your summary and ask.
   Use Node 22 (`nvm use`) and pnpm, never npm. `pnpm lint` must report 0 errors and 0 warnings (`contracts/redocly.yaml`).
2. **Generated types in `libs/mf-contract`.** Replace the Day 1 hand-made types marked `// TODO(TECH-2)` with `import type` from `@nimbus/api-client/model` (SPEC.md §2.4).
3. **Shared libs (TECH-14), before `messageFor`.** `libs/logger`, `libs/messages`, `libs/format` as in SPEC.md §9, every function unit-tested (titles `TECH-14:`).
4. **`libs/api-client`.** Orval 8.45.0 config based on `docs/reference/orval.config.mjs`, generating into `src/generated/` (git-committed):
   - React Query hooks + models, Vue Query hooks, Zod schemas, MSW handlers with Faker.
   - A shared `customFetch` mutator in `src/http.ts`: base path `/api` (same origin, ADR-0005), `credentials: 'same-origin'` set explicitly, `X-Nimbus-Csrf: 1` on every POST/PUT/PATCH/DELETE except `reportVitals`, no `Authorization` header. Parses `application/problem+json` into a typed `ApiError` (with `code`, `params`, `status`, `fieldErrors`). Validates responses with the generated Zod schemas in dev/test (API-5).
   - `configureApiClient({ onUnauthorized })`: each area calls it at start-up; a 401 calls `onUnauthorized` (SPEC.md §2.4, SPEC-SHL-1).
   - `src/errors.ts`: `messageFor(problem)` maps `code` + `params` to the messages in `libs/messages` (`specs/mock-data.md` §9); for `QUOTA_EXCEEDS_PLAN` and `QUOTA_BELOW_USAGE` it picks the message by `params.resource` (`storage` → bytes via `formatBytes`, `vms` → count via `formatCount`); unknown codes → `errors.INTERNAL` (MSG-3).
   - Unit tests for `customFetch` (401 → `onUnauthorized`, CSRF header on mutations only, problem parsing, Zod validation failure) and `messageFor`.
5. **CI `contract:check`.** Rebuild contract + regenerate client, then `git diff --exit-code contracts/openapi.yaml libs/api-client/src/generated`. Add it to CI before lint.
6. **`apps/mock-api`.** Fastify 5 + `@fastify/websocket` on port 4000, serving every operation in `openapi.yaml` under `/api`:
   - Seed data, users, plans (`Money` in micro-units), seeded tasks, task runner and env vars exactly as in `specs/mock-data.md`. Config comes from the required `NIMBUS_MODE` (`dev` · `e2e` · `demo`) plus `MOCK_*` overrides, validated with Zod at start-up and logged once; a missing or invalid mode stops the server. Never read `NODE_ENV`.
   - Session cookie `nimbus_session` (`HttpOnly; Secure; SameSite=Strict; Path=/api`); `login` returns `Me` (with `tenant` for tenant roles); `logout` clears the cookie and closes the session's sockets with 4401. No CORS headers. Mutating requests to authenticated endpoints need `X-Nimbus-Csrf: 1` and an `Origin` in `APP_ORIGINS`, else 403 `FORBIDDEN` (NFR-SEC-6). `POST /api/rum` is the only exemption: `Origin`-checked, rate-limited to 60/min per client IP, 16 KB body limit, schema-validated.
   - Server-side RBAC from SPEC.md §5.2, including scope (all / own). Read `x-permission` from the contract rather than duplicating the mapping by hand. `listVms` / `listBuckets`: 422 without `tenantId` for provider/reseller, 404 for a `tenantId` outside scope. Changes to a suspended tenant's VMs, buckets or quotas → 409 `TENANT_SUSPENDED` (`TENANT_NOT_ACTIVE` only for `suspendTenant`). Quota errors carry `params.resource`.
   - Request validation against the contract, returning `422 VALIDATION_FAILED` with `errors[]`.
   - Cursor pagination, search, filter and sort for tenants, VMs, buckets and tasks.
   - WebSocket `/api/events` with heartbeat every 15 s, session checked at upgrade and on every heartbeat tick, close codes 4401/4403/4429 (WS-5, `x-close-codes`; at most 5 sockets per session), event scoping (RT-12, including `tenant.updated` / `quota.updated` for the session's own tenant), and the events `task.updated` (with increasing `seq`), `vm.updated`, `tenant.updated`, `quota.updated`, `bucket.updated`.
   - `createTenant` returns `201 TenantCreated { tenant, task }`.
   - Test endpoints under `/api/__test/` from `specs/mock-data.md` §8 (`reset`, `emit`, `expire-session`, `fail-next-task`, `set-usage`, `drop-sockets`), acting on the caller's session where stated. They exist only when `NIMBUS_MODE` is `dev` or `e2e`. `reset` re-seeds task times relative to now.
   - Integration tests (Vitest + `fastify.inject`) for: RBAC denial per role, reseller scoping, CSRF header and `Origin` rejection (AC-SHL-1.10), each 409/422 error code in mock-data §9 that the API can produce, pagination, a VM reboot task emitting progress with increasing `seq` then completion, socket close 4401 on expiry, and event scoping for a tenant_admin and a tenant_viewer (AC-SHL-6.14, AC-SHL-6.15), and the 6th socket closing with 4429. Title them with `TECH-3:` or the AC ID.
   - **Contract test:** every mock-api response in the integration tests is validated with the generated Zod schemas.
7. Add `mock-api` to `pnpm dev` and `pnpm e2e:stack`.
8. Write ADR-0003 (TypeSpec as source of truth, Orval generation) in the same PR (SPEC.md §13).

## Acceptance
- `pnpm contract:build && pnpm api:generate` produces no git diff on a clean checkout.
- `curl -i -X POST localhost:4000/api/login -H 'content-type: application/json' -H 'X-Nimbus-Csrf: 1' -H 'Origin: http://localhost:8080' -d '{"role":"tenant_admin"}'` returns `Me` and a `Set-Cookie: nimbus_session=…; HttpOnly; Secure; SameSite=Strict; Path=/api` header; `GET /api/me` with that cookie returns `tenant.id: "t_acme"` and the tenant_admin permissions. The same `POST` without `X-Nimbus-Csrf` returns 403.
- `GET /api/tenants` as reseller_admin returns `total: 1200`.
- Rebooting a VM over HTTP emits `task.updated` progress events on `/api/events` and finishes in 5–8 s.
- All tests green in CI, including `contract:check`.

Finish with the AGENTS.md §6 summary.
