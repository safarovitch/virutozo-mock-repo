# Day 3 — Decisions

- **Status:** Accepted · **Date:** 2026-10-31 · **Owner:** Rasul Idiev
- **Input:** `docs/reviews/2026-10-31-day-3-spec-check.md`

## Part 1 — owner decisions

| ID | Decision | Applied in |
|---|---|---|
| D3-01 | **(a)** The header shows a button with the user's name; it opens a menu with the role as plain text (context only, never used for authorization) and *Sign out*. | SPEC-SHL-2 behaviour |
| D3-02 | **(a)** Success and info toasts auto-dismiss after 5 s, paused while hovered or focused. **Error toasts stay until dismissed.** | SPEC.md §8.2 Toast |
| D3-03 | **(b)** All 11 §8.2 components ship on Day 3 with stories and `play` tests; TECH-6 is done on Day 3. | `specs/tech-tasks.md` TECH-6 |
| D3-04 … D3-17 | Accepted as proposed in the spec check (the agent decides missing details). | see the review file |

## Part 2 — decisions the agent made while building Day 3

(Recorded under the "What blocks building" rule, for review at the end of the day.)

| ID | Decision (agent) | Why |
|---|---|---|
| A3-01 | **Storybook tests and IDs.** Only stories tagged `play` run in Chromium (`storybook-test`, CI `ci/storybook-test`), and their names start with an ID (`TECH-6: …`). Every story, including plain state stories, is also rendered once by a jsdom test titled `TECH-6: <file> / <story> renders`. | H5 needs every test title to start with an ID; Storybook's Vitest addon turns every story into a test named after it. |
| A3-02 | **ui-kit-vue scope:** Button, StatusBadge, ProgressBar, EmptyState / ErrorState / Skeleton, ConfirmDialog, Drawer, `v-can`. The Vue DataTable comes with the VM list (SPEC-CMP-1, Day 6). No Vue Toast, Wizard or UsageBar: Compute toasts go through the shell (`toast:show`) and Compute has no wizard or usage bar in the MVP. | D3-03 covers the 11 React components; §8.2 asks Vue for "the subset Compute needs". TanStack Vue Table isn't pinned, and the VM list will define what the Vue table needs. |
| A3-03 | Component CSS lives in `@nimbus/design-tokens/components.css`, shared by both kits; each kit's entry point imports it. | One look for React and Vue without the Vue kit depending on the React package. |
| A3-04 | **Token contrast test** (`libs/design-tokens/src/contrast.test.ts`, 16 pairs): all current tokens meet WCAG AA. | §8.1 requires it in CI; the design-tokens guide said it "arrives with TECH-6". |
| A3-05 | DataTable sorts every column **ascending first** (`sortDescFirst: false`), until R35 is decided with the tenant list (Day 5). | TanStack's default (numbers descending first) isn't specified anywhere; ascending is predictable. |
| A3-06 | Dialog and Drawer use the native modal `<dialog>` (inert background, focus return) and handle Escape on `keydown`. | The native dialog only closes on a trusted Escape; handling keydown makes real and test events behave the same and lets the owner decide what closing means (URL drawers). |
| A3-07 | **The shell's session store never navigates.** The signed-out state carries `redirect` (`/login` after sign-out, the expiry URL after a 401), and the router follows it. | React Router 8 runs `navigate()` as a transition, so the router rendered the old URL as signed out first and sent the user to `/login?returnTo=…` (caught by e2e; see agent log). |
| A3-08 | Strings: D3-05's `shell.loading` became the shared `common.loading`; added `common.*` (retry, close, cancel, confirm, next, back, dismiss, actions, notifications, stepOf, typeToConfirm, errorTitle), `usage.warning` / `usage.danger` and `shell.configError`. All `draft` for F10. | MSG-1: the ui-kit has no inline strings either. |
| A3-09 | The user menu is a **disclosure** (button + panel, Escape and outside click close it), not an ARIA `menu`; the button's label is "Account: <name>". | A disclosure needs no arrow-key model; the label contains the visible name (WCAG 2.5.3). |
| A3-10 | The login page uses a radio group for the four roles, with Provider admin preselected. | Four options, all visible; one click to sign in for the demo. |
| A3-11 | Shell `QueryClient`: queries don't retry; response validation is `log` in production builds, `throw` otherwise. `@tanstack/react-query` isn't an MF shared singleton yet: tenants and storage don't use it until Day 5 (A1-09 TODO stays). | Sharing a package an app doesn't have breaks its build (A1-09). |
| A3-12 | e2e signs in through the real login page (`signIn` helper) and expires sessions with `POST /api/__test/expire-session` from the page, so the browser sends the cookie. Smoke tests now sign in as provider_admin first; their assertions are unchanged, one alert locator is filtered by text. | Every e2e run also exercises sign-in; the toast region's empty live region made `getByRole('alert')` ambiguous. |
| A3-13 | **Statuses:** AC-SHL-1.1, 1.2, 1.5–1.9, 1.12, 2.1, 2.3, 3.1, 3.3 and TECH-6 → `done`. AC-SHL-1.3 (tenant rows: Day 5), 1.4 (e2e via WS 4401: Day 4), 1.13 (Quotas view: Day 5), 3.2 (first mutating action) stay `in-progress`; AC-SHL-2.2 stays `planned` (Day 4). | D3-04. Each `done` AC has a passing test titled with its ID. |
| A3-14 | `@nimbus/ui-kit` added as a dependency of tenants and storage. | D1-11 makes it a shared singleton; an app must have the package for the share to build. |
| A3-15 | **Not approved:** pnpm reports an "agent skill" shipped by `@tanstack/react-table` awaiting `pnpm approve`. Left for the owner. | Supply-chain decision; the agent doesn't approve its own tooling. |
