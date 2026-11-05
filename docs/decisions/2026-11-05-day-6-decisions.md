# Day 6 — Decisions

- **Status:** Accepted · **Date:** 2026-11-05 · **Owner:** Rasul Idiev
- **Input:** `docs/reviews/2026-11-05-day-6-spec-check.md`

## Part 1 — owner decisions

| ID | Decision | Applied in |
|---|---|---|
| D6-01 | **(a)** Day 6 builds the admin plumbing only: compute reads `?tenantId`, applies url-conventions (removed for tenant roles; added from `vm.tenantId` on `/compute/:vmId`) and lists that tenant's VMs. An admin without `tenantId` sees `compute.chooseTenant` with no picker. Every admin action asks for confirmation naming the tenant (AC-CMP-4.3). AC-CMP-5.4 and AC-CMP-4.3 → `done`. Day 8 adds the picker, *Acting on tenant* line and the admin banner. E2E-10 covers the tenant side today, suspending through the API; E2E-11 moves to Day 8. | SPEC-CMP-1, SPEC-CMP-4, SPEC-CMP-5, SPEC.md §10 |
| D6-02 | **(a)** Progress appears once: the *Status* cell (spinner, transitional badge, %) and the drawer's *Current task*. Action buttons stay visible and disabled with the AC-CMP-2.4 tooltip. SPEC-CMP-2's "button area" wording is changed to match. | SPEC-CMP-2 behaviour |
| D6-03 | **(a)** An `error` VM shows *Start*, *Stop* and *Reboot* disabled with tooltip `compute.vmInError` (new `draft` string). No contract change. | SPEC-CMP-2 behaviour, mock-data §10 |
| D6-04 … D6-19 | Accepted as proposed in the spec check (the agent decides missing details). | see the review file |

## Part 2 — decisions the agent made while building Day 6

(Recorded under the "What blocks building" rule, for review at the end of the day.)

| ID | Decision (agent) | Why |
|---|---|---|
| A6-01 | **Day 1 compute mount tests:** they now mount with a tenant session (`vm:read`) and the fake API, because the area renders data only with `vm:read`. Every assertion is unchanged. | H4; flagged for your review. |
| A6-02 | **Action buttons:** *Start*, *Stop* and *Reboot* are always rendered (with `vm:operate`), so rows don't shift. A button that doesn't apply to the status (e.g. *Stop* on a stopped VM) is plainly disabled. When everything is blocked, the buttons stay focusable with `aria-disabled` and a tooltip, in this order: suspended tenant (`tenantStatus.suspendedBanner`), operation in progress (AC-CMP-2.4), `error` (D6-03). | RBAC-4/D3-10: a reason must be reachable by keyboard; status-specific buttons explain themselves. |
| A6-03 | **Strings:** `compute.progress` "{percent}%" (draft) for the status cell and drawer. `compute.vmNowStatus` uses the `status.vm.*` label in lower case ("web-01 is now stopped."). | AC-CMP-1.4 wording; no extra keys per status. |
| A6-04 | **Heading:** compute's `h1` is the area name `areas.compute` "Compute", as in tenants; `compute.title` "Virtual machines" names the table. | Six existing e2e tests use the area heading (agent log). |
| A6-05 | **e2e `exclusive` project, wider than D6-16:** it now holds every test that acme's other sessions can see: E2E-10, the real-reboot journeys (E2E-4 with AC-CMP-2.1/5.3, AC-CMP-1.5) and AC-TEN-1.6 (moved unchanged from `tenants.spec.ts`). Each exclusive file calls `POST /api/__test/reset` in `afterAll`, so a reused server gives the same results next run. | Parallel runs failed AC-SHL-2.2, AC-SHL-1.12 and AC-TSK-1.6 (agent log). |
| A6-06 | **AC-SHL-1.12 setup:** after sign-in the test waits for the VM table before expiring the session. Assertions unchanged. | Since Day 6 compute loads data on `/compute`; a request in flight at expiry correctly ends the session as expired, which is not what this AC is about. H4; flagged for your review. |
| A6-07 | **New ACs from existing behaviour bullets of SPEC-CMP-2:** AC-CMP-2.5 (Stop confirmation), AC-CMP-2.6 (409 `VM_BUSY` handling, D6-09), AC-CMP-2.7 (`error` VMs, D6-03), all `done`. Also **AC-CMP-4.7 → `done`**: it's URL plumbing D6-01 already required (tenant roles' `tenantId` is removed). | TEST-1 needs a known ID for each test; wording taken from the spec bullets. Revert to `planned`/delete if you prefer otherwise. |
| A6-08 | **Toasts and tasks:** compute shows the outcome toast only for tasks started in this mount; others appear in the task center. Every VM `task.updated` is written to `getTask` (and the drawer's recent tasks when cached), so a VM whose task started elsewhere usually needs no fetch. | D6-10; no duplicate toasts across tabs. |
| A6-09 | **Tenant name in the admin confirmation:** from compute's own `getTenant` cache when the session has `tenant:read`; otherwise the tenant ID. | RT-4 table lists `getTenant` for compute. |
| A6-10 | **Pinia store** (`compute-ui`): the pending confirmation, the IDs of tasks started here, and the announcer. Cleared on unmount (RT-7). | D6-19. |
| A6-11 | **Shell:** the session store's `patchTenantStatus` is internal (subscribed to `server:tenant.updated` per session). The banner region (`role="status"`) is always in the DOM and empty unless suspended, so the change is announced. `RemoteHost` has no unit test for the new `update(ctx)` on session change; E2E-10 covers it end to end. | D6-14. |
| A6-12 | **Statuses:** AC-CMP-1.1–1.5, 2.1–2.7, 5.1–5.4, 4.3, 4.7 and AC-SHL-8.1 → `done`. AC-SHL-8.2 stays `in-progress` (bucket half, Day 8, D6-15). | `pnpm trace` passes. |
| A6-13 | **Dependencies:** compute gets `@tanstack/vue-query` 5.105.0 (already in the lockfile), **`pinia` 3.0.4 (new to the lockfile; peer `vue ^3.5.11`)**, workspace packages, and dev deps `@storybook/vue3-vite`/`storybook` 10.6.5, `@testing-library/vue` 8.1.0, `@testing-library/dom` 10.4.2, `@testing-library/user-event` 14.6.8 (ui-kit-vue's versions). | D6-19. |
| A6-14 | **Not built:** compute has no `RemoteBoundary.vue` (`onErrorCaptured` → `remote:error`, MF-6) yet; `specs/shared/realtime.md` shows one in its example. | Not in Day 6's specs; noted for SPEC-SHL-4 (Day 7). |
| A6-15 | **Local evidence:** unit/component tests green for 20 affected projects; e2e 50/50 three runs in a row on one server (`GATEWAY_PORT=8090`, 0 retries); compute Storybook builds (15 state stories, each rendered by the jsdom smoke test). | |
