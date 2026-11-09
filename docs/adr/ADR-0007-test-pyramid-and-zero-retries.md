# ADR-0007 — Test pyramid and zero-retry policy for PRs

- **Status:** Accepted
- **Date:** 2026-10-31 · updated 2026-11-01 (Day 5, TECH-5: how `trace:check` and `ci/perf` work)
- **Deciders:** Rasul Idiev
- **Related:** SPEC.md §10 (TEST-1…TEST-6), §3.3 (T1–T6), §12, `.github/workflows/ci.yml`, TECH-5

## Context

Most of this codebase is written by coding agents. Tests are the main proof that an acceptance criterion is met, so they must be fast enough to run on every change, cheap to keep green, and impossible to "pass" by retrying a flaky run until it goes green.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **A. Pyramid: most checks as unit/component tests (Vitest), a few e2e journeys (Playwright), zero retries on PRs** | Fast feedback; failures point at the cause; flakes surface instead of hiding | Needs discipline to write lower-level tests first; e2e must be deterministic |
| B. E2E-first (most ACs proven in the browser) | Closest to real use | Slow, flaky, hard to diagnose; agents tend to add sleeps and retries |
| C. Allow 1–2 retries on PRs | Fewer red builds | Hides real race conditions; "green" stops meaning "works" |

## Decision

**Option A.**

- **Layers (SPEC.md §10):** static checks (tsc, ESLint, custom rules) → unit (Vitest) → component (Vitest + Testing Library + MSW) → Storybook interaction tests → contract (Zod validation of responses) → a small set of e2e journeys (Playwright, Chromium on PRs, against the gateway) → non-blocking perf.
- Each AC is proven at the **lowest level that can prove it**; journeys (E2E-1…16) are the end-to-end proof of whole flows.
- **Zero retries on PRs** (`retries: 0` in Playwright, no retry in Vitest). A flaky test gets a `BUG-*` issue and a fix, never a skip or a retry (TEST-4).
- E2E is deterministic: `NIMBUS_MODE=e2e` (seed 42, no latency, no random failures); failure paths are forced through test endpoints (TEST-6).
- No fixed sleeps in Playwright; role-based selectors only (TEST-3, TEST-5).
- Every test title starts with a known ID (TEST-1), so `trace:check` can prove each AC and TECH item (T1–T6).

## Consequences

- **Positive:** PR runs stay fast; a red build means something is actually wrong; agents can't make a test pass by weakening or retrying it (HOOK-3 also blocks that).
- **Negative:** flaky tests block merges until fixed; some behaviour (timing, realtime) needs fake timers and harnesses rather than a quick e2e check.
- **Day 1 state:** `ci/hooks`, `ci/affected`, `ci/no-test-hooks` and `ci/e2e` exist with zero retries; the remaining jobs arrive with their TECH items (TECH-5 done on Day 5).

## Day 5 additions (TECH-5, D5-20, D5-21)

- **`trace:check` reads test titles statically** (`tools/check-trace.ts`, `tools/trace/`). It doesn't run tests: passing is already enforced by the blocking jobs (`ci/affected`, `ci/storybook-test`, `ci/e2e`, `ci/hooks`), which never retry. So "a passing test titled with the ID" = a title in code that isn't skipped, in a repo where those jobs are green. Only `it(`/`test(` in code count; the same text inside a string fixture or a comment doesn't. Story `play` names count when they start with an ID. Rejected: collecting results from every runner's JSON report. It needs all suites in one job, and `nx affected` deliberately doesn't run them all.
- **T1, T2 and T6 read the PR description** (`Implements:` line, AGENTS.md §6) from the GitHub event; locally `pnpm trace --pr-body <file>`. Without one, T3–T5 run and the coverage report prints.
- **`verify:` jobs must exist** in `.github/workflows/` for every TECH item that isn't `planned`.
- **`ci/perf` measures, never judges:** Chromium with 4× CPU throttling (CDP), the full 10,000-tenant scroll three times, long tasks via `PerformanceObserver`, the median reported. After the runs it plants a 120 ms task and checks it was recorded, so "0 long tasks" can't come from a broken instrument (code run by `page.evaluate` isn't a page task and isn't observed). The job is `continue-on-error`; the result goes to the job summary and the PR report.
- **`ci/report`** keeps one PR comment up to date (trace coverage + perf); `ci/size` adds the bundle diff with TECH-11.
- **Nightly (`ci/nightly-e2e`):** the same e2e suite on Chromium, Firefox and WebKit over HTTPS (`https://localhost:8443`, gateway `TLS=1`, a self-signed certificate generated for that run). Non-blocking: a failure opens or updates one issue.
