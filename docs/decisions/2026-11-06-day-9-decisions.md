# Day 9 — Decisions

- **Status:** Accepted · **Date:** 2026-11-06 · **Owner:** Rasul Idiev
- **Input:** `docs/reviews/2026-11-06-day-9-spec-check.md` (owner: "continue with recommendations")

## Part 1 — owner decisions

| ID | Decision | Applied in |
|---|---|---|
| D9-01 | **(a)** All 10 `nimbus/*` rules that AGENTS.md names ship as errors in `tools/eslint-rules/`, with RuleTester tests (`TECH-10:`). Scope per rule as in the spec check; existing violations are fixed, never suppressed. Each rule is recorded in `docs/review-rules.md`. | `tools/eslint-rules`, `eslint.config.mjs`, `docs/review-rules.md` |
| D9-02 | **(a)** The MCP spec server is registered in a root `.mcp.json` (not a harness file). `bug-reproducer` uses the shell and the Playwright CLI; SPEC.md §11.3's Tools cell changes accordingly. | `.mcp.json`, SPEC.md §11.3 |
| D9-03 | **(a)** New dependencies: `web-vitals` (shell), `size-limit` + `@size-limit/file` (root dev), `@modelcontextprotocol/sdk` (`tools/mcp-spec-server`), at their current versions, listed in ADR-0001. | `package.json`s, ADR-0001 |
| D9-04 | **(a)** RUM `route` is the route **template** (no IDs, no query). `/_vitals` is a shell route gated on a new `vitals:read` permission held only by `provider_admin`; `getVitalsSummary` requires it (contract change); not in the sidebar. | contract, RBAC matrix, SPEC-SHL-5 |
| D9-05 | **(a)** Budgets measure what actually loads: a remote's `remoteEntry.js` and the chunks reached from `./mount`, minus shared-singleton fallbacks; "shell initial JS" is `index.html`'s entry closure. If a budget fails on that measure, the agent stops and shows the numbers. | `.size-limit.cjs`, `ci/size` |
| D9-06 | **(a)** Order: TECH-10 → TECH-11 → SPEC-SHL-5 → TECH-13 → TECH-12 → TECH-8 → TECH-9 (2 fixtures; §11.6 becomes "at least 2, target 5") → ADR-0006 → README → rehearsal. | — |
| D9-07 … D9-14 | Accepted as proposed in the spec check. Day 8 committed as `e31b657` (D9-14). | see the review file |

## Part 2 — decisions the agent made while building Day 9

(Recorded under the "What blocks building" rule, for review at the end of the day.)

| ID | Decision (agent) | Why |
|---|---|---|
| A9-01 | **9 lint rules, not 10.** AGENTS.md names exactly nine `nimbus/*` rules; the spec check miscounted. H8 (raw HTML, web storage) is enforced with built-in rules (`vue/no-v-html`, `no-restricted-syntax`, `no-restricted-globals`, `no-restricted-properties`). The codebase had **no** violations; probes confirm each rule fires. | Correction of D9-01's count. |
| A9-02 | The lint plugin and the MCP server are **plain `.mjs`** (`// @ts-check`, JSDoc), not TypeScript. The plugin reads `ID_PREFIXES` (tools/trace/ids.ts) and the generated `Permission` values as text and throws if it finds none, so each list stays defined once. | HOOK-1 and MCP clients run with the shell's default Node 20, which can't load `.ts` (agent log). |
| A9-03 | **BUG-6:** 64 stale `.js` files removed from `libs/api-client/src/generated/model` (`git rm`, reversible), with a failing-first test. They're not Orval output and shadowed the generated `.ts`. | H1 protects generated code from edits; removing files the generator never writes restores what H1 means. Obvious fix, recorded for your review. |
| A9-04 | `POST /api/__test/reset` also clears the RUM rate windows. The AC-SHL-5.3 e2e (seeds `/api/rum`) runs in the `exclusive` project after a reset. | Every closed e2e page sends a beacon from the same client IP, so the parallel suite keeps `/api/rum` at 60/min and a seed gets 429. Test endpoint only; production limits unchanged. |
| A9-05 | **Size measurement (D9-05):** an entry's static + dynamic relative imports, minus `__prebuild__` chunks, `localSharedImportMap` and dynamic imports made by `loadShare` chunks (fallbacks for shared singletons). The shell's ui-kit chunk is its own budget. Results: shell 179.5/180 kB, tenants 78.4/120, storage 72.0/80, compute 109.2/110, ui-kit 24.5/60. All pass; no budget changed. | `tools/ci/bundle-closure.mjs` with tests (`TECH-11:`). |
| A9-06 | `/_vitals` stays in the initial bundle. Lazy-loading it made the shell's initial JS **larger** (179.5 → 180.4 kB, over budget) because of split overhead, so it was reverted. | Measured, not assumed. The shell has 0.5 kB left; the next shell feature needs a budget decision or a trim. |
| A9-07 | **ADR-0006 is "permission-based UI checks; the UI is never the security boundary"** (SPEC.md §13), not the design system as the spec check said (D9-12). Written today from RBAC-1…6 and what's built. | Correction. |
| A9-08 | RUM route templates: `/tenants/:tenantId`, `/compute/:vmId`, other areas `/<area>/:id`, `/login`, `/_vitals`, `/`; anything else `/*`. `remote` is the area or `shell`. Records go out with `sendBeacon`, else the generated `reportVitals` with `keepalive`. | D9-04, D9-07, D9-08. |
| A9-09 | `/_vitals` renders a semantic `<table>` (few rows), ratings as `StatusBadge` text + shape. LCP/INP/FCP/TTFB in whole ms via `formatCount`, CLS with two decimals. New `draft` strings `vitals.*` in mock-data §10. | D9-09. |
| A9-10 | **Evals:** six fixtures (one per skill, TECH-12), each a task from an earlier day with its `base` commit as the snapshot. Two are scored with `--checks` (typecheck, lint, test in a throwaway worktree): `storage-bucket-list` (Day 8) and `create-tenant-wizard` (Day 7), both **100%, as baselines** (built before the skills existed). `region-column` has no run yet. | D9-06: 2 scored. The graders are coarse: rule breaks, tests, statuses, states. |
| A9-11 | Subagent tools: spec-reviewer and code-reviewer `Read, Grep, Glob`; test-writer adds `Write, Edit` (instructed to write tests only and not read implementation); bug-reproducer adds `Bash` (Playwright CLI). A `TECH-13:` test pins them to SPEC.md §11.3. | D9-11, D9-02. |
| A9-12 | **Not changed (security, for review):** the gateway passes a client's `X-Forwarded-For` through to mock-api, which trusts it from 127.0.0.1, so a client can pick its own RUM rate-limit bucket (verified with curl through the gateway: 60 requests with `X-Forwarded-For: 10.9.9.9` → 429, the next with `10.9.9.10` → 204). The gateway should overwrite it with the socket address. | Found while working on A9-04; the gateway is outside today's scope and the e2e no longer relies on it. Candidate `BUG-7`. |
| A9-13 | **Not changed (demo script):** §15 step 2 says the TypeScript error appears "in the tenant table". Rehearsed in a throwaway worktree: adding `region` to `Tenant` breaks the mock seed and the test fakes, not the table. Options in `docs/demo-rehearsal.md`. | Product wording; yours to decide. |
| A9-14 | **Statuses:** AC-SHL-5.1–5.3 → `done`; TECH-8, 9, 10, 11, 12, 13 → `done`. Each has passing tests titled with its ID; `pnpm trace` passes. AC-TEN-3.9/3.10 (quota editing) stay `planned` (cut order). | — |
| A9-15 | **Owner follow-up (2026-11-09, "go ahead with recommendations"):** A9-12 fixed as **BUG-7** (failing test first; the gateway sets `X-Forwarded-For` from the socket on HTTP and on the WebSocket upgrade). A9-13 option (a): SPEC.md §15 step 2 now says the errors appear where `Tenant` objects are built. Day 9 committed and pushed; the live rehearsal ran on 4000/8080 (`docs/demo-rehearsal.md`). | — |
| A9-16 | **Not changed (candidate BUG-8):** under `demo:local` latency the task center lost two running tasks emitted right after sign-in (AC-SHL-2.2 failed once; it passes on the deterministic stack). Likely the first `listTasks` response overwrites newer event data. Details in `docs/demo-rehearsal.md`. | Found in the live rehearsal; outside Day 9's scope. |
