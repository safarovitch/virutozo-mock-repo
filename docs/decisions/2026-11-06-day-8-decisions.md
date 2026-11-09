# Day 8 — Decisions

- **Status:** Accepted · **Date:** 2026-11-06 · **Owner:** Rasul Idiev
- **Input:** `docs/reviews/2026-11-05-day-8-spec-check.md` (owner: "Build Day 8 first", recommended option on D8-01 … D8-04)

## Part 1 — owner decisions

| ID | Decision | Applied in |
|---|---|---|
| D8-01 | **(a)** *Delete* is enabled for every bucket. The typed-name dialog submits; a 409 `BUCKET_NOT_EMPTY` shows `errors.BUCKET_NOT_EMPTY` inline and the dialog stays open. The same path covers stale rows. | SPEC-STO-2 behaviour |
| D8-02 | **(a)** A `/login` tab that gets `signed-in` does a **full page load**: its validated `returnTo` only when the `userId` equals the last user this tab was signed in as, otherwise (or without `returnTo`) the new user's home area. A signed-in tab that gets `signed-in` with a different `userId` reloads in place. | SPEC-SHL-7 behaviour |
| D8-03 | **(a)** Day 7 committed as it was (`c55a5fc`) before any Day 8 code. **BUG-4** (trace scanner and regex literals) and **BUG-5** (`build-e2e` writes `dist-e2e`) fixed today; both are listed in `specs/bugs.md` (no GitHub issues in this repo yet). | `tools/trace`, app builds, gateway, stack scripts |
| D8-04 | **(a)** mock-api generates buckets lazily for tenants other than `acme`: deterministic from (`MOCK_SEED`, `tenantId`), 0–8 buckets named `<tenant-name>-<word>`, sizes summing to the tenant's `storageUsedBytes`. A tenant with nothing used has no buckets. | `apps/mock-api/src/db.ts`, mock-data §6 |
| D8-05 … D8-20 | Accepted as proposed in the spec check (the agent decides missing details). AC-STO-2.5 and AC-STO-2.6 are added (D8-15). | see the review file |

## Part 2 — decisions the agent made while building Day 8

(Recorded under the "What blocks building" rule, for review at the end of the day.)

| ID | Decision (agent) | Why |
|---|---|---|
| A8-01 | The pre-commit hook and every check run with Node 22 (`nvm use`). The default shell had Node 20, so every vitest worker crashed loading undici 8 (`engines: >=22.19`). Nothing was changed; noted in the agent log. | The first Day 7 commit attempt failed on this, not on the code. |
| A8-02 | **e2e run on a private stack (mock-api 4001, gateway 8091).** Your `pnpm dev` mock-api (`tsx watch`, pid 39884) holds 4000 and something not visible to `lsof` holds 8080, so `pnpm e2e` couldn't start its stack. I started mock-api and the gateway by hand on spare ports, ran `GATEWAY_PORT=8091 pnpm e2e`, and stopped both afterwards. Your processes were left alone. | `run-stack.mjs` hard-codes mock-api on 4000; making it configurable is a candidate tooling change. |
| A8-03 | `specs/bugs.md` lists `BUG-*` IDs (BUG-4, BUG-5); `trace:check` already reads every `specs/**/*.md`. | No GitHub issues exist for them; T4 needs a known ID. |
| A8-04 | New strings beyond D8-19: `storage.title` "Buckets" (table label), `storage.loadMore`, `storage.deleteFor` "Delete {name}" (the row button's accessible name; `menu.deleteBucket` "Delete" stays the visible text). All `draft`. | A row's *Delete* needs a name that says which bucket (WCAG 2.4.6). |
| A8-05 | The picker lists with `sort=name`, `limit=20`, and only once it first opens (no request on page load). It's the area's own `listTenants` query (`staleTime` 30 s). Non-active tenants show a `StatusBadge`. | D8-06; nothing loads for an admin who never opens it. |
| A8-06 | Lazy buckets (D8-04) are **1–8** per tenant with usage (0 only when nothing is used); names are `<tenant-name>-<word>`, cut to 63 characters. `createBucket` generates the caller's tenant first, so the uniqueness check sees generated names. | Matches "0–8, 0 when 0 used" without empty-looking tenants that have usage. |
| A8-07 | Compute's `actionState` now takes a reason string instead of a boolean, and `useActionRules().blockedReason` decides it: the own tenant (`tenantStatus.suspendedBanner`, unchanged from Day 6) or the picked tenant (`tenantStatus.suspendedTooltip`, AC-CMP-4.4). | One rule for both, no duplicated checks in the list and the drawer. |
| A8-08 | Storage's dialog stories open their dialog with a `play` function, but without an `AC-*` story name: app stories aren't run in Chromium (only the kits have `storybook-test`), so they mustn't count as AC tests in `trace`. The ACs are covered by `StorageArea.test.tsx` and e2e. | Avoids trace counting tests that never run. |
| A8-09 | **Statuses:** AC-CMP-4.1/4.2/4.4/4.5/4.6, AC-STO-1.1–1.4, AC-STO-2.1–2.6, AC-STO-3.1–3.3, AC-SHL-7.1–7.4 and AC-SHL-8.2 → `done`. Each has a passing test titled with its ID; `pnpm trace` passes. | — |
| A8-10 | **Dependencies (workspace only):** `apps/storage` now depends on `@nimbus/api-client`, `auth`, `format`, `messages` and the same dev tooling as tenants (Testing Library, jsdom, Storybook 10, `@nimbus/test-utils`), at tenants' pinned versions. `pnpm install` added only lockfile entries for storage; nothing new was downloaded. | Storage now has data, tests and stories. |
| A8-11 | **Not changed (harness, H12):** the `guard-bash` allowlist doesn't list `dist-e2e` as a build folder, so `rm -rf apps/<app>/dist-e2e` would be blocked. Rebuilding with `--skip-nx-cache` works instead. Adding it needs `.claude/allow-harness-change`. | H15. |

