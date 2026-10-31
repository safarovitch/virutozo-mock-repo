# Day 2 — Decisions

- **Status:** Accepted · **Date:** 2026-10-31 · **Owner:** Rasul Idiev
- **Input:** `docs/reviews/2026-10-31-day-2-spec-check.md`

## Part 1 — owner decisions

| ID | Decision | Applied in |
|---|---|---|
| D2-01 | **(a)** CSRF leaves the operations: no `CsrfHeader` parameter on any operation. The rule stays documented at API level (namespace `@doc`) and in NFR-SEC-6, and is enforced by mock-api and `customFetch`. Generated function signatures stay clean. | `contracts/main.tsp`, SPEC.md §6.2 |
| D2-02 | **(a)** Every operation can return `CommonErrors` = 422 `Unprocessable` · 429 `RateLimited` · 500 `Internal`; `reportVitals` also returns 413 `PayloadTooLarge` (code `VALIDATION_FAILED`). | `contracts/main.tsp`, SPEC.md §6.1 API-2 |
| D2-03 … D2-11 | Accepted as proposed in the spec check (the agent decides missing details). | see the review file |

## Part 2 — decisions the agent made while building Day 2

(Recorded under AGENTS.md §1a "What blocks building", for review at the end of the day.)

| ID | Decision (agent) | Why |
|---|---|---|
| A2-01 | Denied the install scripts of `esbuild` (via Orval) and `vue-demi` (via Vue Query) in `allowBuilds`. | Security: fewer scripts at install time. Verified unnecessary: generation, strict typecheck and tests all pass without them. |
| A2-02 | New dependencies, latest compatible versions: `@faker-js/faker` 10.6.0, `msw` 3.0.3, `yaml` 2.9.1, `tsx` 4.23.15 (runs the TypeScript mock-api), `@fastify/websocket` 11.3.4 (gateway dev dependency for the proxy test). No `@fastify/cookie` (4 days old; one cookie is parsed by hand) and no `ws` (tests use `injectWS` and Node's built-in `WebSocket`). | Pins from ADR-0001 kept; no peer issues. |
| A2-03 | Orval output excludes the `Realtime` tag from the React and Vue hooks with `includeUnreferencedSchemas: true`; the Zod output keeps it. | D2-04: no `useEvents` hook, but `ServerEvent` keeps its models and Zod schema (verified by a test). |
| A2-04 | `customFetch` throws `ApiError` on non-2xx and returns `{ data, status, headers }` on success; response validation is `'throw'` by default and configurable (`'log'` for production builds). `basePath` defaults to `/api`. | Orval 8's fetch-style mutator expects that shape; throwing lets React/Vue Query treat errors as errors. |
| A2-05 | `ProblemSchema` (Zod) is hand-written in `libs/api-client/src/problem.ts`, tied to the generated `Problem` type with `satisfies`. | Orval only generates schemas for success responses; errors still need validating (API-5, contract tests). |
| A2-06 | `libs/mf-contract` re-exports the generated models with `export type { … } from '@nimbus/api-client/model'`, and its build target is dropped (source-only library like the others; A1-19 superseded). | A type-only re-export keeps F11's "no runtime dependency"; the declaration build pulled api-client files outside its `rootDir`. |
| A2-07 | ESLint ignores `**/src/generated/**`; generated code is still type-checked strictly. | Generated code isn't hand-maintained (H1). |
| A2-08 | **AC-SHL-9.1–9.3 set to `done`** (tests in `libs/api-client/src/errors.test.ts`), although SPEC-SHL-9 is scheduled for Day 3; **AC-SHL-1.10, AC-SHL-6.14, AC-SHL-6.15 set to `done`** (mock-api integration tests). | Implemented and proven by tests today. |
| A2-09 | mock-api is TypeScript run with `tsx`; deterministic seed with a hand-written mulberry32 RNG; tasks end exactly at their duration (the last wait is shortened). | Reuses the generated Zod schemas and models; the first version overran 5–8 s by up to one tick (caught by the acceptance check, now a real-time test). |
| A2-10 | `/api/__test/*` endpoints need no CSRF header and get no latency; sessions survive `reset`. | They're not part of the API contract, exist only in `dev`/`e2e`, and a reset shouldn't sign the e2e user out. |
| A2-11 | mock-api accepts a body-less POST with `content-type: application/json` (empty body = no body); malformed JSON stays 422. | Many HTTP clients send the header without a body (found while checking through the gateway). |
| A2-12 | Fastify errors before a handler: 413 → 413 `VALIDATION_FAILED`; other 4xx → 422 `VALIDATION_FAILED`; anything else → 500 `INTERNAL`; unknown routes → 404 `NOT_FOUND`. | Every response is a contract-valid problem (D2-02). |
| A2-13 | `tools/run-stack.mjs` starts mock-api and the gateway together for `e2e:stack` / `demo:local` and sets `APP_ORIGINS` from `PORT`. | D2-09; one command, clean shutdown when either process exits. |
| A2-14 | **Gateway fix:** forward `Origin` (and `cookie`) on proxied WebSocket upgrades. | `@fastify/http-proxy` forwards only `cookie`, so every proxied socket was closed with 4403. Found by the end-to-end check through the gateway; covered by a new gateway test. |
