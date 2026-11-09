# Day 5 — Decisions

- **Status:** Accepted · **Date:** 2026-11-01 · **Owner:** Rasul Idiev
- **Input:** `docs/reviews/2026-11-01-day-5-spec-check.md`

## Part 1 — owner decisions

| ID | Decision | Applied in |
|---|---|---|
| D5-01 | **(a)** Two states per column, never "unsorted". The first click on a new column uses its natural direction (*Name* ascending; *Created* and *Storage used* descending), every further click flips it. `sort=name` is the default and is left out of the URL. | SPEC-TEN-1 behaviour |
| D5-02 | **(a)** A live `tenant.updated` updates the row in place, even if it no longer matches the status filter; count and membership are corrected at the next refetch (filter change, *Retry*, reconnect). | SPEC-TEN-1 behaviour |
| D5-03 | **(a)** Day 5's row menu has *Open details*, *View VMs*, *View buckets*. *Suspend*/*Resume* (row menu and drawer) arrive with SPEC-TEN-4 on Day 7. AC-TEN-3.11 stays `in-progress` until then. | SPEC-TEN-1, SPEC-TEN-3 behaviour |
| D5-04 | **(a)** Filter and sort changes push a history entry. Search pushes once when a new search starts and replaces while the user keeps typing. URL corrections replace. | `specs/shared/url-conventions.md` |
| D5-05 … D5-23 | Accepted as proposed in the spec check (the agent decides missing details). | see the review file |
| — | **Push and PR approved:** the agent may push `day-1-foundation` to `origin` and open a PR at the end of the day, so TECH-5's jobs are shown running on GitHub. | TECH-5 |

## Part 2 — decisions the agent made while building Day 5

(Recorded under the "What blocks building" rule, for review at the end of the day.)

| ID | Decision (agent) | Why |
|---|---|---|
| A5-01 | **DataTable additions (ui-kit):** `onEndReached` (once per data length, when one of the last 10 rows renders), `fetchingMore` (spinner row), `refreshing` (thin header bar), `skeletonRows`, `rowCount` (`aria-rowcount` from the server's `total`). Sorting never returns to "unsorted" (`enableSortingRemoval: false`); a column starts descending with `sortDescFirst`. | D5-01, D5-11. The existing TECH-6 sort play test is unchanged and still passes. |
| A5-02 | **Suspended tenant's quotas:** the read-only values plus a visible note `tenantStatus.suspendedTooltip`, not a tooltip on plain text. | A tooltip on non-interactive text can't be reached by keyboard (NFR-A11Y). Same wording as the spec. |
| A5-03 | **List cache:** one `useInfiniteQuery` keyed by `getListTenantsQueryKey(params)` without the cursor; `keepPreviousData` so a filter change keeps rows on screen with the header bar; plans cached for the session (`staleTime: Infinity`). Every write (events, optimistic save) goes through `patchTenant`/`applyQuotas`, which update all list pages and the drawer's caches together. | RT-4; one place for cache writes. |
| A5-04 | **401 inside the remote:** `mount.tsx` configures the remote's own api-client copy so a 401 publishes `session:expired`; the shell ends the session as for any other expiry. | The api-client isn't an MF singleton, so the shell's `configureApiClient` doesn't reach remotes. |
| A5-05 | **`unmount()` clears the tenants `QueryClient`.** | AC-SHL-1.3: nothing from one session's tenant rows survives into the next. |
| A5-06 | **Component tests and stories use an in-memory fake API** (`apps/tenants/src/testing/fake-api.ts`), not the generated MSW handlers. | The Faker-based MSW handlers return random data and don't apply the server's rules (search, sort, cursors, quota checks), which these ACs test. SPEC.md §10 names MSW for component tests; the fake API is the same idea with real rules. Proposed: keep MSW for "any valid response" tests only. |
| A5-07 | **Row menu** is a disclosure with buttons (like the user menu, D4-02), not an ARIA `menu`. Clicks inside it don't reach the row. | Consistent with the shell's menus; no roving focus needed for three items. |
| A5-08 | **Drawer tabs** are ARIA tabs (Left/Right/Home/End move and select); each switch is a `replace` (AC-TEN-3.12). The drawer has real `<a href>` links for *View VMs* / *View buckets* that navigate through the shell on a plain click. | Open-in-new-tab keeps working. |
| A5-09 | **Tenants Storybook** on port 6009 (`apps/tenants/.storybook`, plain React config like the shell's, A4-08). 19 state stories, rendered by a jsdom smoke test. No `play` stories yet, so no `storybook-test` target. | H6. 6006–6008 are taken. |
| A5-10 | **`trace:check` enforces TEST-1** (every title starts with an ID) as an error. Every existing title already complies. It also scans `*.perf.ts`. | SPEC.md §10 TEST-1; the lint rule (TECH-10) comes on Day 9. |
| A5-11 | **Perf instrument check:** after the 3 runs, the perf test plants a 120 ms task and reports whether it was recorded. Local result (MacBook): 0 long tasks over 50 ms in all 3 runs at 4× throttling; instrument check ok. The Linux CI number is the reference. | The first local run reported 0 long tasks before the observer had been shown to work (see agent log). |
| A5-12 | **Nightly config:** `NIGHTLY=1` adds Firefox and WebKit projects, `TLS=1` switches the base URL to HTTPS with `ignoreHTTPSErrors`. Verified locally over HTTPS on Chromium only (40/40 at `https://localhost:8443`); Firefox and WebKit aren't installed on this machine, so their first run is GitHub's. | D5-21. |
| A5-13 | **e2e never changes data other workers read:** AC-TEN-1.6 uses `/api/__test/emit` (an event without a stored change); AC-TEN-3.3's save is proven by component tests; AC-TEN-3.2's e2e is blocked client-side before any request. | One shared mock-api, parallel workers, 0 retries. |
| A5-14 | **AC-SHL-3.2 → `done`:** the quota save is the first mutating action; a forced 403 publishes the `errors.FORBIDDEN` toast and the optimistic change rolls back (component test). | D3-14's rule, now exercised. |
| A5-15 | **Tests for states without an AC** are titled with the rule they prove: `MSG-1` (empty state from the catalogue), `MSG-3` (mapped error + Retry), `RBAC-5` (no access), `RT-4`, `RT-6`, `RT-7` (cache events, reconnect, cleanup). | T4: every title starts with a known ID. |
| A5-16 | **Statuses:** AC-TEN-1.1–1.7, AC-TEN-3.1–3.4, 3.6–3.8, 3.12, 3.13, AC-SHL-1.3, AC-SHL-1.13, AC-SHL-3.2 and TECH-5 → `done`. AC-TEN-3.11 stays `in-progress` (*Resume*, Day 7, D5-03); AC-TEN-3.9 and 3.10 stay `planned` (Day 8, D5-17). | Each `done` item has a passing test titled with its ID; `pnpm trace` passes T3–T5. |
| A5-17 | **Dependencies:** `@tanstack/react-query` 5.105.0 added to tenants and storage (D5-19); tenants dev dependencies for Storybook and Testing Library at the shell's versions. No new packages in the lockfile. | D5-23. |
| A5-18 | **Local evidence:** e2e 40/40 in one run with 0 retries, twice (`GATEWAY_PORT=8090`), plus 40/40 over HTTPS on 8443. Day 4's open point A4-15 is closed by the first run of the day (26/26). | |
