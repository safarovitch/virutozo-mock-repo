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
