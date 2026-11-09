# Day 2 spec check — 2026-10-31

- **Scope (SPEC.md §14, Day 2):** contract package, generated clients (TECH-2), shared libs (TECH-14), mock-api (TECH-3), ADR-0003. Prompt: `prompts/day-2-contract.md`.
- **Read:** the prompt, `contracts/main.tsp`, `specs/mock-data.md`, `specs/shared/rbac.md`, `specs/shared/realtime.md`, `specs/shared/messages-and-format.md`, SPEC.md §6, ADR-0005, `docs/reference/orval.config.mjs`.
- **Deferred items in these areas:** R74 (task visibility), R82 (stretch task kind; not Day 2), R83 (no 429/5xx declared), R86 (`t_acme` quotas), R88 (generated VMs), R89 (missing 422s), R90 (generated `events` hook).
- **Classes (AGENTS.md §1a):** product decision · contradiction · missing detail. Under "What blocks building", missing details are the agent's to decide; contract changes still need the owner (the Day 2 prompt: "Do not change the contract's meaning … list it and ask").

## Needs the owner (contract changes)

| ID | Class | Finding | Options |
|---|---|---|---|
| D2-01 | contradiction | The contract models CSRF as a required operation header (`...CsrfHeader` on every mutation). Orval turns header parameters into arguments of the generated functions, so every mutating hook would require callers to pass `{ 'X-Nimbus-Csrf': '1' }`, although `customFetch` is meant to add it. (To be confirmed when generating; this is how Orval handles header parameters.) | **(a, recommended)** Move CSRF out of the operations: keep it documented as a global rule (API-level `@doc` + NFR-SEC-6) and enforced by mock-api and `customFetch`; the generated signatures stay clean. **(b)** Keep it and let callers pass the header (every call site repeats it). |
| D2-02 | contradiction | The mock-api must return `422 VALIDATION_FAILED` for any invalid request, 429 for the `reportVitals` rate limit (E5), a size error for bodies over 16 KB, and may return 500 `INTERNAL`. The contract doesn't declare these on most operations: no 422 on `runVmAction` (invalid `action`), `listTasks` (bad `status`/`since`), `getTask`/`getVm`/`deleteBucket` (malformed path IDs); no 429, 413 or 5xx anywhere (R83, R89). The contract test (every response validated with the generated Zod schemas) would then fail for responses the server is required to send. | **(a, recommended)** Add a shared `CommonErrors = Unprocessable \| RateLimited (429) \| Internal (500)` to every operation, plus `PayloadTooLarge (413, code VALIDATION_FAILED)` on `reportVitals`. **(b)** Keep the contract and have the contract test skip undeclared statuses (weaker). |

## Decided by the agent unless you object (missing details)

| ID | Finding | Decision |
|---|---|---|
| D2-03 | `customFetch` must validate responses with the generated Zod schemas (API-5), but a generic mutator doesn't know which schema belongs to which call. | A small generator step writes `src/generated/response-schemas.ts`: a map from `METHOD path-template` to the operation's Zod response schema, built from `openapi.yaml`. `customFetch` looks it up; unknown routes aren't validated (logged in dev). |
| D2-04 | R90: the `events` operation (WebSocket, `x-transport: websocket`) would get a generated fetch hook and an MSW handler. | Keep its models and Zod schemas; skip the hook and handler through an Orval operation override. A test asserts no `useEvents` export exists. |
| D2-05 | R86: `t_acme`'s quotas aren't given, but mock-data says usage is "about 82%" and `t_acme` has 40 VMs. | `t_acme`: storage quota **250 GiB** (Business default), bucket usage totalling **205 GiB** (82%); VM quota **50** (Business max; must be ≥ 40 VMs). Added to mock-data §4. |
| D2-06 | R88: IDs and VMs of generated tenants aren't specified exactly. | Tenant IDs `t_` + 5 lowercase base-36 characters from the seeded RNG; other tenants' VMs generated lazily but deterministically from (`MOCK_SEED`, `tenantId`) with IDs `vm_<suffix>_<nn>` (F5). |
| D2-07 | R74 (part): which tasks `listTasks` returns per role isn't specified, and mock-api implements it today. | Same scoping as events (RT-12): providers see all tasks, resellers tasks of their tenants, tenant roles tasks of their own tenant. The task-center UI parts of R74 stay with Day 4. |
| D2-08 | Behind the gateway, every request reaches mock-api from the gateway's IP, so "60 requests per minute per client IP" would be one shared bucket. | The gateway forwards `X-Forwarded-For` (its proxy default); mock-api trusts it only from `127.0.0.1` (`trustProxy`). Integration test for two client IPs. |
| D2-09 | `APP_ORIGINS` defaults to port 8080, but local e2e runs on another `PORT` when 8080 is busy (A1-18): every mutation would get 403. | `pnpm e2e:stack` / `demo:local` set `APP_ORIGINS` from `PORT`; the default stays as documented. |
| D2-10 | New dependencies not pinned by ADR-0001: `@faker-js/faker` (Orval mocks), a YAML parser (reading `x-permission` from `openapi.yaml`), `seedrandom`-style RNG. | Latest versions compatible with the pins; listed in the summary. MSW 3.x, Orval 8.45.0, `@fastify/websocket` 11.3.x and TanStack Query 5.105.0 as pinned. |
| D2-11 | The Orval reference config was verified against the v1.1 contract; the contract has changed a lot since (cookie auth, `Money`, `Problem.params` as a record, nullable unions, close-codes extension). | Verify generation passes strict `tsc`; if a construct breaks the generator, stop and report it (that would be a contract question). |

## Not findings (checked)
- `login` needs the CSRF header before a session exists: fine, the header isn't a secret.
- `Secure` cookies over `http://localhost`: fine in Chromium (PR e2e); other browsers run over HTTPS nightly (E8).
- The prompt's step order puts the `mf-contract` type swap before the client exists: the plan does it after generation.

**Status:** waiting for "go", and for decisions on D2-01 and D2-02.
