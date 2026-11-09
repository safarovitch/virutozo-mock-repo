# Demo rehearsal — 2026-11-06 (Day 9)

A dry run of the interview demo (SPEC.md §15), step by step: what I ran, what I saw, and what's left for the live run. Run by the agent; the human run with `pnpm demo:local` (latency and failures on) is still to do.

**Stack used:** a private copy of the e2e stack (mock-api on 4001, gateway on 8091, `NIMBUS_MODE=e2e`, no latency), because a `pnpm dev` session held ports 4000 and 8080 (A8-02). Before the live demo, stop `pnpm dev` and run `pnpm demo:local`.

| # | Step | How I checked it | Result |
|---|---|---|---|
| 1 | **Spec → code trace.** Open SPEC-TEN-2, show an AC, run `pnpm trace`, jump to the test named `AC-TEN-2.4`. | `pnpm trace` (535 titles, T1–T6 green); the MCP tool `coverage_for AC-TEN-2.4` lists the component test and its line. | ✅ Works. Tip: show `coverage_for` too; it answers "where's the test" in one call. |
| 2 | **Contract-first.** Add a field in `main.tsp`, regenerate, show the TypeScript error until it's handled. | In a throwaway worktree: `region: string` on `Tenant` → `pnpm contract:build && pnpm api:generate` → `nx typecheck`. | ⚠️ Works, but **the errors aren't in the tenant table**. They're where `Tenant` objects are built: `apps/mock-api/src/db.ts`, `app.ts` and `apps/tenants/src/testing/fake-api.ts` (6 errors). The table compiles unchanged, because nothing forces a new column. Script wording needs a decision (below). |
| 3 | **App tour.** Provider: scroll 10k tenants → create tenant (409 path) → tenant admin: reboot a VM in the Vue remote → progress in the React task center. | The e2e journeys for each part pass against the gateway: AC-TEN-1.1 (10k scroll, ≤ 60 rows in the DOM), AC-TEN-2.4 (409 jump), AC-CMP-2.1 (reboot with live progress, task center), AC-TSK-1.x. | ✅ by e2e (83/83). Not yet seen by a human with 150 ms latency and 10% failures: with `MOCK_FAILURE_RATE=0.1` a step can fail on stage; that's the point (mapped error + Retry), but rehearse it once. |
| 4 | **Resilience.** `POST /__test/fail-remotes {"remotes":["storage"]}` → Storage shows an error panel, the rest works → toggle back → *Retry*. | `curl` on the gateway: storage `remoteEntry.js` 503, tenants 200; restore → 200. The UI side is AC-SHL-4.x (e2e green). | ✅ Works. |
| 5 | **Harness.** Ask the agent to "add a Region column". Show the MCP lookup, HOOK-2 blocking a generated-file edit, the lint rule catching a raw `fetch`, the hook feeding the error back. | MCP `get_operation listTenants` / `search_specs region` answer (TECH-8 tests). HOOK-2: hook tests (`pnpm test:hooks`, 71/71). Lint: a raw `fetch` in `apps/storage/src` is reported by `nimbus/no-direct-fetch`, also through the post-edit hook (Node 20). | ✅ Each piece works. Record the run as the `region-column` eval (`pnpm eval region-column --head <commit>`). |
| 6 | **Quality gates.** Open a PR: CI shows AC coverage, bundle size diff, Playwright traces and axe results. | Not run: needs a pushed branch and GitHub Actions. Locally: `pnpm trace`, `pnpm size` (all 5 budgets pass), e2e traces kept on failure, axe in e2e. | ⏳ Branch pushed 2026-11-09; CI runs on pull requests, and `gh` isn't signed in here, so the PR is yours to open. `ci/size` is new; check it runs on the first PR. |
| 7 | **What I'd do next.** ADRs and the README "Where the agent failed and what I changed". | ADR-0001…0007 exist (0006 written today); README has the curated 8 entries and links the full log. | ✅ |

## Live run — 2026-11-09 (`pnpm demo:local`, 150 ms latency, 10% failures)

- **Port 8080 is taken by a local Apache httpd** (root-owned system service, not this repo). The stack ran with `GATEWAY_PORT=8090 pnpm demo:local`. For the interview, either stop Apache or keep a `.env` with `GATEWAY_PORT=8090` (`.env.example` already has it).
- **Journeys under latency and failures:** 63 e2e journeys run against the demo stack: 62 passed. The one failure, AC-SHL-2.2, is worth a look before the interview. Two `task.updated` events arrived, yet the task center showed no running tasks. Likely cause: the task center's first `listTasks` response (150 ms late) replaces newer event data. That race only shows with latency. **Candidate BUG-8**, not fixed (outside Day 9's scope). On stage it would look like the task center "forgetting" a VM reboot started right after sign-in; wait for the page to settle before step 3's reboot.
- **Step 4** on the demo stack: storage 503 while failed, compute 200, back to 200 after the toggle. ✅

## Decided
- **Step 2 wording:** option (a), SPEC.md §15 reworded (A9-15).

## Watch on stage
- Shell initial JS is at 179.5 of 180 kB, and compute at 109.2 of 110 kB (`pnpm size`). A demo change that adds code to the shell can turn `ci/size` red.
- CLS on the tenant drawer page measured 0.20 ("needs improvement") in the RUM e2e. If you open `/_vitals` on stage, that row is visible.
