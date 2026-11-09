# Spec review v1.3 → v1.4 — Decisions

- **Status:** Accepted · **Date:** 2026-10-30 · **Owner:** Rasul Idiev
- **Input:** "Spec review, third pass (v1.3)" findings V1–V33, plus the six conflicts reported while applying v1.3.
- **Adds to** (does not replace) `SPEC-REVIEW-v1.3-decisions.md`.
- **Numbering:** as in v1.3, new ACs are labelled `E<n>.<letter>`. The agent gives each the next free AC number in the named spec and records the mapping. Rewritten ACs keep their IDs. Withdrawn ACs are **retired**, never reused (see E14).

| # | Topic | Closes |
|---|---|---|
| E1 | Gateway SPA fallback and the e2e build mode | V1, V3 |
| E2 | Event scoping for a user's own tenant | V4 |
| E3 | Test endpoints and the session cookie | V2, V26 |
| E4 | Build plan: schedule the new specs and shared libs | V19, V21 |
| E5 | `reportVitals` and CSRF | V5 |
| E6 | Messages for a suspended tenant and for VM quota | V6, V11, V15, V25 |
| E7 | The perf AC and the trace rules | V7 |
| E8 | Browsers for e2e | V9 |
| E9 | Test levels for harness-only ACs | V12, V18, V24 |
| E10 | VM detail route and `canOpen` | V10 (= R73) |
| E11 | Vue error handling in production | V8 |
| E12 | Session and multi-tab details | V13, V14, V16, V17, V33 |
| E13 | Storage tenant context ACs | V27 |
| E14 | Traceability bootstrap, rule-ID registry, TECH verification | V20, V22, V23 |
| E15 | Housekeeping | V28, V29, V30, V31, V32 |

---

## E1 — Gateway SPA fallback and the e2e build mode
**Closes:** V1, V3

**SPA fallback (V1).** The gateway resolves a request in this order:
1. `/api/*` → proxy to mock-api (including the WebSocket upgrade).
2. `/remotes/<name>/*` → that remote's static files. A missing file returns **404 and never falls back**, so a broken remote fails loudly (MF-4 relies on this).
3. A real file in the shell's build → serve it.
4. Any other `GET` or `HEAD` whose `Accept` includes `text/html` → the shell's `index.html` with **200**.
5. Anything else → 404.

In dev, Vite's dev server already falls back to `index.html`.

**E2E build mode (V3).** There are three build modes:

| Mode | Used by | `VITE_TEST_HOOKS` | Test routes (`/__crash`) |
|---|---|---|---|
| `development` | `pnpm dev` | true | yes |
| `e2e` | CI e2e, perf, local `pnpm e2e` | true | yes |
| `production` | deploys, size budgets | false | **no** |

`e2e` is a production-optimised build (minified, same chunking) plus the test hooks. A CI step (`ci/no-test-hooks`) builds `production` and fails if `__crash` or `/__test/` appears in any bundle. Size budgets (NFR-PERF-1) measure the `production` build.

**New ACs (SPEC-SHL-1):**
- **E1.a** Reloading `/tenants/t_acme?tab=quotas` through the gateway (as provider_admin) shows the same view.
- **E1.b** A request for a missing file under `/remotes/storage/` returns 404, not `index.html`.

## E2 — Event scoping for a user's own tenant
**Closes:** V4

Rewrite **RT-12**:
> A session receives events about resources it can read, **plus** `tenant.updated` and `quota.updated` for its own tenant (`me.tenant.id`), even without `tenant:read`. Resellers receive events for their own tenants and providers for all.

This makes AC-SHL-8.2 achievable. Add a mock-api integration test: **E2.a** (SPEC-SHL-6) a tenant_viewer's socket receives `tenant.updated` for `t_acme` and nothing for other tenants.

## E3 — Test endpoints and the session cookie
**Closes:** V2, V26

- **mock-api test endpoints move under `/api/__test/*`.** They're proxied by the gateway, and the `Path=/api` cookie is sent, so the endpoint knows whose session it acts on:

  | Endpoint | Acts on |
  |---|---|
  | `POST /api/__test/reset` | everything (re-seed) |
  | `POST /api/__test/expire-session` | the caller's session (cookie). Body `{ "all": true }` expires every session |
  | `POST /api/__test/drop-sockets` | the caller's sockets; `{ "all": true }` drops every socket |
  | `POST /api/__test/fail-next-task` | global: next task of `kind` fails with `code` |
  | `POST /api/__test/set-usage` | `{ tenantId, usedBytes }` |
  | `POST /api/__test/emit` | broadcast a `ServerEvent` (subject to RT-12 scoping) |

- **Gateway test endpoints** stay at the gateway root under `/__test/` (`/__test/fail-remotes`). They don't need a session.
- Test endpoints exist only in `development` and `e2e` modes, never in `production` (E1).
- **Re-seeding (V26):** `POST /api/__test/reset` re-seeds everything, and seeded task times are relative to **the reset time**. Tests that check relative times call reset first.

## E4 — Build plan
**Closes:** V19, V21

The v1.3 additions grew the MVP by about 40%, so the plan is **9 days**, with a clear cut list.

**New TECH item (V21):** *Shared libs: `libs/logger`, `libs/messages`, `libs/format`*. It takes the next free TECH number, is scheduled on Day 2 **before** `messageFor`, and every function is unit-tested.

| Day | Milestone |
|---|---|
| 1 | Spec split into `specs/features/` (first commit) · workspace, gateway, shell + 3 remotes, MF, e2e smoke against 8080 · hooks + lefthook · CI |
| 2 | Contract package · generated clients · shared libs (logger, messages, format) · mock-api with cookie session, CSRF, test endpoints |
| 3 | SPEC-SHL-1/2/3 (sign-in, nav, RBAC, 403) · SPEC-SHL-9 (messages wiring) · ui-kit basics + Storybook |
| 4 | Realtime: `libs/realtime`, root and scoped bus, WS client and close codes (SPEC-SHL-6) · SPEC-TSK-1 task center |
| 5 | SPEC-TEN-1 tenant list · SPEC-TEN-3 drawer |
| 6 | SPEC-CMP-1/2 VM list and actions (Vue) · SPEC-CMP-5 VM detail (E10) · SPEC-SHL-8 tenant context |
| 7 | SPEC-TEN-2 wizard · SPEC-TEN-4 suspend/resume · SPEC-SHL-4 isolation |
| 8 | SPEC-STO-1/2 storage · SPEC-CMP-4 and SPEC-STO-3 admin tenant context · SPEC-SHL-7 multi-tab |
| 9 | Harness (skills, subagents, MCP server, evals, lint rules) · size budgets · RUM · ADRs · README · demo rehearsal |

**Cut order if time runs out:** SPEC-SHL-7 multi-tab → `/_vitals` page → eval fixtures (keep 1) → SPEC-STO-3 → SPEC-TEN-3 quota editing → storage delete flow.
**Never cut:** contract generation, RBAC, cookie session, realtime + tasks, e2e in CI, AGENTS.md + hooks.

## E5 — `reportVitals` and CSRF
**Closes:** V5

`reportVitals` is **exempt** from the CSRF header, because `sendBeacon` can't set headers. It's safe because it's unauthenticated, append-only and anonymous. It's still protected:
- `Origin` check (`sendBeacon` sends one)
- rate limit of 60 requests per minute per client IP
- 16 KB body limit
- schema validation (422 on invalid input)

Rewrite **NFR-SEC-6**: *"Every mutating request to an authenticated endpoint requires `X-Nimbus-Csrf: 1` and a same-origin `Origin`. The only exemption is `reportVitals`: unauthenticated, append-only, Origin-checked, rate-limited, size-limited."*

## E6 — Messages: suspended tenant, VM quota, placeholders, wording
**Closes:** V6, V11, V15, V25

**New error code `TENANT_SUSPENDED` (409, V6)** for any change to resources of a suspended tenant (VMs, buckets, quotas). `TENANT_NOT_ACTIVE` stays only for `suspendTenant` on a non-active tenant. Add it to the contract's `ErrorCode` and to mock-data §9.

| Code | Message key | Text |
|---|---|---|
| TENANT_SUSPENDED | `errors.TENANT_SUSPENDED` | This tenant is suspended, so changes are disabled. |

**Quota over plan (V11).** `QUOTA_EXCEEDS_PLAN` carries `params.resource` (`"storage"` or `"vms"`), and the UI picks the message by it:

| Key | Text | `{max}` formatting |
|---|---|---|
| `errors.QUOTA_EXCEEDS_PLAN.storage` | {plan} allows up to {max}. | bytes via `formatBytes` → "100 GiB" |
| `errors.QUOTA_EXCEEDS_PLAN.vms` | {plan} allows up to {max} VMs. | count via `formatCount` → "10" |

- New AC **E6.a** (SPEC-TEN-2): on Starter (max 10 VMs), entering 20 blocks *Next* with "Starter allows up to 10 VMs."
- The same rule applies to `QUOTA_BELOW_USAGE` (`.storage`, `.vms`).

**Placeholder values (V15):**

| Key | Text |
|---|---|
| `rbac.disabledTooltip` | You don't have permission to {action}. |
| `actions.createTenant` | create tenants |
| `actions.suspendTenant` | suspend tenants |
| `actions.resumeTenant` | resume tenants |
| `actions.updateQuota` | change quotas |
| `actions.operateVm` | start, stop or reboot VMs |
| `actions.createBucket` | create buckets |
| `actions.deleteBucket` | delete buckets |
| `areas.tenants` / `areas.storage` / `areas.compute` | Tenants / Storage / Compute |

AC-TEN-4.4's tooltip is therefore "You don't have permission to suspend tenants."

**Strings without keys (V25):**

| Key | Text |
|---|---|
| `shell.connection.label` | Connection |
| `shell.connection.connected` / `.reconnecting` / `.offline` | Connected / Reconnecting… / Offline |
| `tenants.list.count` | Showing {shown} of {total} tenants |

ACs must quote the **key** next to the text.

**Wording review (V25).** The agent-drafted strings in mock-data §10 are **reviewed by Rasul, not the agent**. Until then they're marked `draft` in the file, and `trace:check` warns (doesn't fail) while any `draft` remains.

## E7 — The perf AC and the trace rules
**Closes:** V7

The smoothness check is a **target, not an acceptance criterion**:
- Retire AC-TEN-1.8 (E14) and replace it with **NFR-PERF-5**: *"While scrolling 10,000 tenants, the median of 3 throttled runs (Chromium, 4× CPU) has no long task over 50 ms."*
- It's reported by the non-blocking `ci/perf` job on every PR.
- NFRs aren't subject to T2/T3, so there's no conflict.
- The DOM row limit (≤ 60 rows) stays an AC in the blocking e2e suite.

## E8 — Browsers for e2e
**Closes:** V9

| Suite | Browsers | Blocking | Origin |
|---|---|---|---|
| PR e2e | Chromium | yes | `http://localhost:8080` |
| Nightly (scheduled) | Chromium, Firefox, WebKit | no; opens an issue on failure | `https://localhost:8443` (gateway with `TLS=1` and a self-signed cert; Playwright `ignoreHTTPSErrors`) |

The nightly suite runs over HTTPS, so `Secure` cookies behave the same in WebKit. ADR-0005 notes this.

## E9 — Test levels for ACs that need a harness
**Closes:** V12, V18, V24

| AC | Level | How |
|---|---|---|
| AC-TEN-3.5 (V12) | split into 3 | **(a)** mock-api integration: `updateQuotas` emits `quota.updated` with the new values. **(b)** storage component test: a `server:quota.updated` on a fake bus updates the usage card with zero HTTP calls (MSW asserts none). **(c)** e2e: after saving a quota in the tenant drawer, opening `/storage?tenantId=t_acme` shows the new quota. The original text is retired and these three get new IDs. |
| AC-SHL-6.9 (offline after 5 attempts, V18) | unit | a fake `WebSocket` that always fails, plus fake timers. E2E covers only `reconnecting` (via `drop-sockets`). |
| AC-SHL-4.5 (permissions change via `update`, V24) | component | a mount harness in `libs/test-utils` mounts compute, then calls `update()` with a `SessionSnapshot` without `vm:operate`. |

`libs/test-utils` gains `mountRemote(module, ctx)` and `createFakeBus()`. This is part of the realtime TECH item (Day 4).

## E10 — VM detail route and `canOpen`
**Closes:** V10 (= R73)

**New SPEC-CMP-5 *VM detail*** (Vue, Day 6). Route: `/compute/:vmId` (plus `?tenantId=` for admins). A drawer over the VM list with:
- Overview: name, status, vCPU, memory, disk, IP, image, created.
- Current task with progress.
- Recent tasks: `listTasks?resourceId=` in compute's own cache.

States: loading, not found ("This item no longer exists."), error.

**`canOpen(resource, me)`** (`libs/auth`) returns a URL or `null`:

| `resource.type` | URL | Requires |
|---|---|---|
| `tenant` | `/tenants/{id}` | `tenant:list` |
| `vm` | `/compute/{id}` (+ `?tenantId={task.tenantId}` if `me.tenant` is null) | `vm:read` |
| `bucket` | `null` (no bucket tasks exist, and buckets have no detail route) | — |

AC-SHL-4.6 keeps `/compute/vm_01`, now backed by this route.

**New ACs (SPEC-CMP-5):**
- **E10.a** `/compute/vm_01` opens the drawer for web-01, including after a reload.
- **E10.b** A non-existent VM ID shows "This item no longer exists."
- **E10.c** A running task's progress updates live in the drawer.
- **E10.d** (SPEC-TSK-1) *View resource* on a VM task opens that VM's drawer.

## E11 — Vue error handling in production
**Closes:** V8

Don't parse the `info` string. It's a short code in production builds.
- Compute's root component is `<RemoteBoundary>`. It uses `onErrorCaptured` to catch **every** error raised inside Vue components (setup, render, lifecycle hooks, watchers, component event handlers). It renders nothing further, publishes `remote:error { fatal: true }` and returns `false`.
- Errors outside components (`window` `error` / `unhandledrejection` from compute code) are published with `fatal: false` and only logged.

**Accepted difference from React**, written into MF-6: React error boundaries don't catch event-handler errors, so in React remotes those are non-fatal; in Vue they're fatal. Both still produce exactly one logger entry, and either way the user is never left with a silently broken view.

## E12 — Session and multi-tab details
**Closes:** V13, V14, V16, V17, V33

- **V13.** Rewrite AC-SHL-1.9: "`context.cookies()` shows `nimbus_session` with `httpOnly: true`, `secure: true`, `sameSite: 'Strict'`, `path: '/api'`, and `localStorage`/`sessionStorage` contain no value equal to the cookie's value."
- **V14.** Retire **AC-SHL-1.11**; AC-SHL-1.6 covers reloads. Add one more case to AC-SHL-1.6: reloading `/compute` as tenant_admin.
- **V16.** Add to SPEC-SHL-7:
  - A tab on `/login` that receives `signed-in` refetches `/me` and navigates to its validated `returnTo` or the home area.
  - On `signed-out` or `expired`, unsaved input (open wizard, dialogs) is **discarded without a prompt**. Security wins over convenience, and the user sees why via `/login?reason=…`.
  - New AC **E12.a**: a tab on `/login` follows a sign-in in another tab.
- **V17.** At most **5** WebSocket connections per session. The 6th gets close 4429. Add to WS-5 and mock-data §7.
- **V33.** `SessionSnapshot` (in `libs/mf-contract`), plain frozen data derived from `Me`:
  ```ts
  export interface SessionSnapshot {
    readonly user: { readonly id: string; readonly name: string; readonly email: string };
    readonly role: Role;                          // display only (RBAC-1)
    readonly tenant: Readonly<TenantSummary> | null;
    readonly permissions: readonly Permission[];
  }
  ```
  Permission checks use `can(snapshot, permission)` from `libs/auth`. The shell calls `update()` only when `user.id`, `tenant` or `permissions` change (shallow comparison).

## E13 — Storage tenant-context ACs
**Closes:** V27

New ACs for SPEC-STO-3, mirroring SPEC-CMP-4:
- **E13.a** A reseller_admin picking one of their tenants sees its buckets and usage card, read-only.
- **E13.b** A foreign `tenantId` in `/storage?tenantId=` shows "This item no longer exists."

## E14 — Traceability bootstrap, rule IDs and TECH verification
**Closes:** V20, V22, V23

- **Bootstrap (V20).** Splitting the spec into `specs/features/` is the **first commit of TECH-1**. Until that folder exists, `trace:check` runs only T1 and prints a warning. Example lines in SPEC.md use a placeholder format (`AC-XXX-n.m`) inside code blocks, and the parser ignores code blocks.
- **Rule-ID registry (V23).** `tools/trace/ids.ts` holds the allowed **prefixes**: `AC TECH BUG NFR MF RT WS RBAC API TEST MSG HOOK E2E ADR`. `trace:check` builds the list of **existing IDs** by scanning:
  - `specs/features/*.md`, `specs/tech-tasks.md` and SPEC.md for bold IDs at the start of a list item or table cell (`**RT-12**`)
  - `docs/adr/` filenames
  - GitHub issues for `BUG-`

  T4 rejects unknown IDs **and retired IDs**.
- **Retired IDs:** `specs/retired-ids.md` lists each withdrawn ID with its replacement, e.g. `AC-TEN-1.8 → NFR-PERF-5`, `AC-SHL-1.11 → AC-SHL-1.6`, and the old AC-TEN-3.5 → its three new IDs.
- **TECH verification (V22).** A `done` TECH item needs **at least one test whose title starts with its ID**. `verify:` lines may only name a **TECH-specific** CI job (`ci/contract-check`, `ci/size`, `ci/no-test-hooks`), never `ci/affected`. `trace:check` confirms the job exists in the workflow file.

## E15 — Housekeeping
**Closes:** V28, V29, V30, V31, V32

- **V28.** Renumber SPEC.md §0 as 1–6 in order.
- **V29.** Replace the sample in §11.1 with *"See `AGENTS.md`; this section only describes what it must cover."* That stops the two copies drifting apart.
- **V30.** `contracts/` uses **pnpm** and Node 22, in every prompt and doc:
  ```bash
  nvm use                      # Node 22 from .nvmrc
  cd contracts
  rm -rf node_modules          # once, to clear the npm/pnpm mix
  pnpm install && pnpm build && pnpm lint
  ```
  After Day 2, use `pnpm nx run contracts:contract-build` from the root.
- **V31.** Add `contracts/redocly.yaml`:
  ```yaml
  extends:
    - recommended
  rules:
    info-license: off           # internal demo API
    no-server-example.com: off  # localhost servers are intentional
  ```
  Lint must then report 0 errors and 0 warnings. (Both rule names were confirmed against Redocly's output on 2026-10-30.)
- **V32.** AGENTS.md §4 adds:
  ```bash
  pnpm e2e:stack     # build --mode e2e, start mock-api (4000) + gateway (8080)
  pnpm e2e           # Playwright against :8080 (starts e2e:stack via webServer if not running)
  ```

---

## Earlier v1.3 notes, accepted as the agent derived them
- mock-api serves its REST API under `/api`.
- `APP_ORIGINS` allows `http://localhost:8080` and `http://localhost:4200` (dev), plus `https://localhost:8443` for the nightly suite (E8).
- TECH numbering as assigned (Day 7 harness work moved to new IDs; MCP server, evals and lint rules keep TECH-8/9/10).
- D4 and D8 subsections both live under §9.

## Still deferred
The section C batch (R6, R13 e2e part, R15–R17, R19–R21, R25, R26–R30 except the two RUM ACs, R34–R43, R45–R60, R63, R65–R70, R74, R76–R83, R86, R88–R90, R93, R94, R96–R100). **These are no longer reviewed as one batch.** Each is resolved **on the day its area is built** (E4 plan), as part of that day's spec check (see the process note below).

---

## Process change: stop full-spec review passes
Three full passes have produced 100+, 30 and 33 findings. Many of the later ones are consequences of the fixes themselves, so another full pass will keep finding new issues indefinitely. From now on:

1. Apply this file, then run **one** check, limited to E1–E15: *"Confirm each E-decision is applied consistently; list only contradictions it introduced."*
2. Start Day 1.
3. **Each day,** before building, run the spec-reviewer **only on that day's specs**, plus any section C items in those areas. Decide, apply, build.

This is also the workflow the job describes: specs good enough for the next piece of work, reviewed critically, improved as you go.

---

## Agent prompt

> Read `docs/decisions/SPEC-REVIEW-v1.4-decisions.md` in full, plus SPEC.md, `specs/`, `contracts/`, AGENTS.md, ADR-0001, ADR-0005 and `prompts/`.
>
> Apply E1–E15 exactly. Rules:
> - Change nothing no decision requires. If a decision conflicts with the current files, stop and list the conflict instead of choosing.
> - New ACs: the next free number in the named spec, status `planned`; record the `E<n>.<letter>` → AC-ID mapping in the SPEC.md v1.4 changelog. Create `specs/retired-ids.md` for the retired IDs.
> - Contract (use Node 22 and pnpm as in E15): add `TENANT_SUSPENDED`, `params.resource` doc for quota errors, and move test endpoints out of the contract if present (they're not part of the API). Then `pnpm build && pnpm lint` in `contracts/` must give 0 errors and 0 warnings.
> - Leave mock-data §10 strings marked `draft`; don't reword them.
>
> Finish with: a per-decision summary (E1…E15 → files and sections), the ID mapping, the lint result, and conflicts found. Then do **one** limited check: confirm each E-decision is applied consistently and list only contradictions it introduced. Don't run a full spec review.
