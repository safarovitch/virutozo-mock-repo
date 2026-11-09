# Day 7 — Decisions

- **Status:** Accepted · **Date:** 2026-11-05 · **Owner:** Rasul Idiev
- **Input:** `docs/reviews/2026-11-05-day-7-spec-check.md` (owner: "continue with recommendations")

## Part 1 — owner decisions

| ID | Decision | Applied in |
|---|---|---|
| D7-01 | **(a)** The cached tenant status never changes optimistically. While a `tenant.suspend` / `tenant.resume` task runs, the status cell and the drawer show a spinner with `status.tenant.suspending` "Suspending…" / `status.tenant.resuming` "Resuming…" (new `draft` strings). `tenant.updated` sets the real status; on failure the row shows `active` again. | SPEC-TEN-4 behaviour, mock-data §10 |
| D7-02 | **(a)** *Resume* opens a plain confirm (`tenants.resume.*`, no typing) and runs the same task flow, toast `tenants.toast.resumed`. New AC **AC-TEN-4.6**. | SPEC-TEN-4 behaviour + AC table, mock-data §10 |
| D7-03 | **(a)** `provisioning` and `error` tenants show *Suspend* disabled with tooltip `tenants.suspendUnavailable` "Only active tenants can be suspended." (new `draft` string). | SPEC-TEN-4 behaviour, mock-data §10 |
| D7-04 | **(a)** A new tenant is inserted at the top of the first page of every cached `listTenants` query whose filters it matches, whatever the sort; that query's total goes up by 1. It moves to its sorted place on the next refetch. | SPEC-TEN-2 behaviour |
| D7-05 … D7-23 | Accepted as proposed in the spec check (the agent decides missing details). | see the review file |

## Part 2 — decisions the agent made while building Day 7

(Recorded under the "What blocks building" rule, for review at the end of the day.)

| ID | Decision (agent) | Why |
|---|---|---|
| A7-01 | **New string `tenants.lifecycleInProgress`** "Wait for the current operation on this tenant to finish." (`draft`). While a suspend or resume task runs, *Suspend* / *Resume* are disabled with it. | The tenant stays `active` until the task succeeds (D7-01), so without this a second *Suspend* would start a second task. |
| A7-02 | When a suspend/resume task **succeeds**, the area sets the status it produced at once; `tenant.updated` then confirms it. A failure changes nothing. | The runner sends the final `task.updated` before `tenant.updated`; otherwise the row shows the old status for a moment between "Suspending…" and "Suspended". It isn't a guess: the task already succeeded. |
| A7-03 | `tenants.wizard.edit` is "Edit {step}" (e.g. "Edit Details"), not "Edit". | Review has two *Edit* links; each needs a name that says where it goes (WCAG 2.4.4). |
| A7-04 | `RemoteErrorBoundary` lives in `@nimbus/ui-kit` (React, takes an `onError` callback, no bus import). `reportUncaughtErrors(remote, events, codeBase)` lives in `@nimbus/mf-contract` (framework-agnostic). `codeBase` = `new URL(import.meta.env.BASE_URL, import.meta.url).href`, so dev (one port per remote) and the gateway (`/remotes/<name>/`) both work. | Remotes can't import each other (H7); both helpers are shared by three remotes. No new dependency. |
| A7-05 | Crash routes check `import.meta.env.MODE !== 'production'` before matching `/__crash`. The thrown messages say "render crash for tests" rather than `__crash`, and compute's crash component throws from `setup` (lint `vue/require-render-return` rejects a `render` that only throws). | `ci/no-test-hooks` searches bundles for `__crash`; it passes. `onErrorCaptured` catches `setup` errors too. |
| A7-06 | After a fatal `remote:error`, `RemoteHost` unmounts the remote in a microtask. | The remote reports from inside its own render or error hook; unmounting synchronously there would unmount a root mid-render. |
| A7-07 | ui-kit: `Button` accepts `ref` (React 19 prop), `Wizard` has optional `step` / `onStepChange` (D7-05), and `Modal` stops Escape propagation, so a dialog over another closes alone. All additive; ui-kit tests and play tests pass. | Focus return (AC-TEN-2.6), Edit links and the 409 jump (AC-TEN-2.3/2.4), the discard prompt over the wizard. |
| A7-08 | The wizard validates with `CreateTenantBody.pick(…).extend(…)` from `@nimbus/api-client/zod`; `zod` isn't added to tenants. | The first version imported `zod` directly, which isn't a tenants dependency (agent log). |
| A7-09 | E2E-10's provider now suspends and resumes through the tenants UI. Its setup (resume acme if an earlier run left it suspended) still uses the API. Assertions unchanged. | D6-01 planned the switch for Day 7. |
| A7-10 | **Test titles for behaviour without its own AC** (flag for review): server-error mapping in the wizard and the stale-row 409 → `MSG-3`; plan defaults and the plans error state → `AC-TEN-2.2`; *Suspend* disabled for `provisioning`/`error` (D7-03) → `AC-TEN-4.4`; drawer *Suspend* → `AC-TEN-4.1`. | Every title needs a known ID (H5); these are the closest. A dedicated AC would be cleaner if you want one. |
| A7-11 | **Statuses:** AC-TEN-2.1–2.8, AC-TEN-4.1–4.6, AC-SHL-4.1–4.6 and AC-TEN-3.11 → `done`. Each has a passing test titled with its ID; `pnpm trace` passes. AC-SHL-8.2 stays `in-progress` (bucket half, Day 8, D6-15). | — |
| A7-12 | **Not changed:** `tools/trace` `codeMask` doesn't know regex literals. A regex containing `'` (e.g. `/can't/`) is read as a string start, and the titles after it in that file disappear from the report (5 here). My test now uses a string; the scanner fix is a separate change. | It hid AC-TEN-4.5's test: T3 failed even though the test existed. Candidate `BUG-*`. |
| A7-13 | **Not changed (tooling):** `build` (production) and `build-e2e` write the same `apps/<app>/dist`. After `pnpm check:no-test-hooks`, the next `pnpm e2e` got an Nx cache hit for `build-e2e` that didn't restore the e2e output, so tenants and storage were served as production bundles, without `/__crash`. Locally, rebuild with `pnpm nx run-many -t build-e2e --skip-nx-cache`. CI runs these in separate jobs, so it isn't affected. A fix (separate output dirs, e.g. `dist-e2e`, plus the gateway's paths) touches the gateway and the stack scripts; proposed for review rather than done today. | Found by the second full e2e run: AC-SHL-4.3 failed for the React remotes only. |
