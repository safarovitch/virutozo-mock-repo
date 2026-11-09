---
name: contract-change
description: Change the API contract the right way (AGENTS.md H1) - edit TypeSpec, build, regenerate the clients, fix type errors, update the mock and test fakes. Use whenever an operation, model, enum, permission or error code changes.
---

# Contract change

Never edit `contracts/openapi.yaml` or `libs/api-client/src/generated/**` (hook HOOK-2 blocks it).

1. **Edit `contracts/main.tsp`.** Add the field/enum value/operation with `@doc`; operations carry `@extension("x-permission", "…")` and their error responses.
2. **Build and lint the contract:** `pnpm contract:build` (TypeSpec → `contracts/openapi.yaml`). `pnpm nx run contracts:lint` must give 0 errors and 0 warnings.
3. **Regenerate:** `pnpm api:generate` (Orval: React and Vue Query clients, Zod, MSW, models, response schemas). Check `git status libs/api-client/src/generated`: only `.ts` files change. A `.js` file in there is stale output and shadows the generated `.ts` (BUG-6); its test fails.
4. **Fix type errors:** `pnpm nx run-many -t typecheck`. Every app that switches on the changed enum or reads the model shows up here; handle each case (that's the point, SPEC.md §15 step 2).
5. **Server and fakes:** update `apps/mock-api` (`db.ts` seed, `app.ts` route, `rbac.ts` for permissions) with an integration test; update each area's `src/testing/fake-api.ts`.
6. **Specs:** a new permission → `specs/shared/rbac.md` matrix and list; new error code → `specs/mock-data.md` §9 message row and the catalogue in `libs/messages`; new UI text → §10 rows (`draft`).
7. **Run** `pnpm nx run-many -t lint typecheck test`, then the e2e journeys that use the operation. Name the contract change in the summary (AGENTS.md §6).
