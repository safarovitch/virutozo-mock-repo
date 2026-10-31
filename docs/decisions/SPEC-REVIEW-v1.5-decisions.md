# Spec v1.4 → v1.5 — Decisions for the remaining open items

- **Status:** Accepted · **Date:** 2026-10-31 · **Owner:** Rasul Idiev
- **Closes:** W3, W4, W5, W6, W8, W9, W11, O5, O6, O7, plus three follow-up answers (F12 `canOpen`, F13 `NIMBUS_MODE`, F14 drawer URLs). **O9** needs Rasul's own review (F10).
- **Numbering:** new ACs are labelled `F<n>.<letter>`; the agent assigns the next free AC number in the named spec and records the mapping in the changelog.

| # | Item | Topic |
|---|---|---|
| F1 | W3 | Admins acting on a suspended tenant |
| F2 | W4 | E2E journeys for the new specs |
| F3 | O5 | `errors.QUOTA_BELOW_USAGE.vms` text |
| F4 | O6 | CI job name for size budgets |
| F5 | O7 | VM ID mapping for `t_acme` |
| F6 | W5 | Role in AC-TEN-3.10 |
| F7 | W6 | `libs/format` function names |
| F8 | W8 | Definition of Done wording |
| F9 | W9 | Per-day spec check in AGENTS.md |
| F10 | O9 | Draft strings review |
| F11 | W11 | Where `SessionSnapshot` types come from |
| F12 | — | `canOpen` permission and signature (corrects E10) |
| F13 | — | Server mode: `NIMBUS_MODE` |
| F14 | — | Drawer URL parameters |

---

## F1 — Admins acting on a suspended tenant (W3)

**Rule:** a suspended tenant's resources are read-only for **everyone**, including provider_admin. To make changes, an admin resumes the tenant first. The server returns 409 `TENANT_SUSPENDED` for VM actions, bucket changes and quota updates on a suspended tenant, whoever calls.

**UI**
- **Compute and Storage, tenant picked (D11):** an in-area banner (not the global tenant-role banner) above the table, `role="status"`:
  - key `tenant.suspendedAdminBanner`: "{tenant} is suspended. Resume it to make changes."
  - plus an *Open tenant* link to `/tenants/{id}` when `canOpen` allows it (`tenant:read`).
- **Actions:** all mutating actions for that tenant are disabled, with tooltip key `tenant.suspendedTooltip`: "Changes are disabled while this tenant is suspended."
- **Tenant drawer (SPEC-TEN-3):** for a suspended tenant, the Quotas tab is read-only text with the same tooltip, and *Resume* is the drawer's primary action (`tenant:suspend`).
- **Freshness:** tenant status comes from the area's own cached `listTenants`/`getTenant` data, updated by `server:tenant.updated` (admins receive events for tenants they can read, RT-12). The banner appears or disappears without a reload.

**New ACs**
- **F1.a** (SPEC-CMP-4) A provider_admin with a suspended tenant picked sees the banner, and every VM action is disabled with the tooltip.
- **F1.b** (SPEC-CMP-4) When that tenant is resumed in another tab, the banner disappears and actions are enabled without a reload.
- **F1.c** (SPEC-TEN-3) For a suspended tenant, quota fields are read-only and *Resume* is shown.
- **F1.d** (mock-api integration) `runVmAction` as provider_admin on a suspended tenant returns 409 `TENANT_SUSPENDED`.

## F2 — E2E journeys for the new specs (W4)

Added to SPEC §10 *Required e2e journeys*. ACs can still be covered by unit or component tests; journeys are the end-to-end proof.

| ID | Journey | Covers |
|---|---|---|
| E2E-9 | Two tabs (one context): sign out in A → B lands on `/login`; sign in as another role in A → B reloads with that role's areas; a tab on `/login` follows a sign-in | SPEC-SHL-7 |
| E2E-10 | Two browser contexts: provider_admin suspends `acme` → tenant_admin's header shows "Suspended", banner appears, VM actions disabled; resume → reverts | SPEC-SHL-8, F1 |
| E2E-11 | provider_admin on `/compute`: pick `acme` → open `/compute/vm_01` drawer → reboot with tenant-named confirmation → live progress → reload keeps drawer | SPEC-CMP-4, SPEC-CMP-5 |
| E2E-12 | reseller_admin on `/storage`: pick own tenant → read-only buckets and usage; foreign `tenantId` → "This item no longer exists." | SPEC-STO-3 |
| E2E-13 | `expire-session` → next action lands on `/login?reason=expired&returnTo=…` → reload keeps message → sign in returns to `returnTo` | SPEC-SHL-1, SPEC-SHL-6 |
| E2E-14 | `drop-sockets` → header shows "Reconnecting…" then "Connected"; an event emitted after reconnect updates the UI | SPEC-SHL-6 |
| E2E-15 | Deep links through the gateway: reload `/tenants/t_acme?tab=quotas`, `/compute/vm_01`, `/storage?tenantId=t_acme` (provider_admin) | E1 |
| E2E-16 | Wizard on Starter: VM quota 20 → "Starter allows up to 10 VMs."; storage 200 GiB → "Starter allows up to 100 GiB." | SPEC-TEN-2, SPEC-SHL-9 |

E4's build plan: each journey is due on the day its spec is built (E2E-13/14 on Day 4, E2E-15 on Day 5, E2E-11/10 on Day 6, E2E-16 on Day 7, E2E-9/12 on Day 8).

## F3 — `errors.QUOTA_BELOW_USAGE.vms` (O5)

Both variants are reworded so they read as a pair:

| Key | Text | `{used}` formatted with |
|---|---|---|
| `errors.QUOTA_BELOW_USAGE.storage` | Storage quota can't be lower than current usage ({used}). | `formatBytes` |
| `errors.QUOTA_BELOW_USAGE.vms` | VM quota can't be lower than the current number of VMs ({used}). | `formatCount` |

Update AC-TEN-3.2's quoted text to the storage variant.

## F4 — CI job name for size budgets (O6)

The job is **`size`**, referenced as **`ci/size`** everywhere (workflow, `verify:` lines, SPEC §12, AGENTS.md). It runs `pnpm size`, which calls `size-limit`. Replace every `ci/size-limit`.

## F5 — VM ID mapping for `t_acme` (O7)

Assumed mapping, in the name order already given in mock-data §5. IDs are assigned in that order and are stable for any `MOCK_SEED`:

| IDs | Names |
|---|---|
| `vm_01`–`vm_12` | `web-01`–`web-12` |
| `vm_13`–`vm_16` | `db-01`–`db-04` |
| `vm_17`–`vm_36` | `worker-01`–`worker-20` |
| `vm_37`–`vm_40` | `cache-01`–`cache-04` |

So the seeded tasks reference `vm_01` (web-01), `vm_19` (worker-03), `vm_14` (db-02) and `vm_37` (cache-01). VMs of other tenants use `vm_<tenantId-suffix>_<nn>` (e.g. `vm_8f2k1_03`) and are only generated, never referenced by tests. If the agent's current mock-data uses a different mapping, **keep this one** and update the seeded-task table and any AC that names a VM ID.

## F6 — Role in AC-TEN-3.10 (W5)

"Given a **provider_admin**…". It's the only role that has both `quota:update` and Storage access to `acme` without being its tenant user. (If AC-TEN-3.10 isn't the quota-then-storage e2e check from E9, name the role by the same rule: the least-privileged role that can perform every step.)

## F7 — `libs/format` function names (W6)

Framework-agnostic, pure, every function unit-tested with the D8 examples. Locale handling is internal (the D8 table).

```ts
formatBytes(bytes: number): string                      // 107374182400 → "100 GiB", 1610612736 → "1.5 GiB", 0 → "0 B"
gibToBytes(gib: number): number                         // 100 → 107374182400 (quota inputs)
bytesToGib(bytes: number): number                       // 107374182400 → 100 (prefilling inputs)
formatPercent(ratio: number): string                    // 0.799 → "79%", 1.04 → "104%"
usageLevel(ratio: number): 'ok' | 'warning' | 'danger'  // < 0.8 ok, < 0.95 warning, else danger (exact ratio)
formatCount(n: number): string                          // 10000 → "10,000"
formatDateTime(iso: string): string                     // → "30 Oct 2026, 22:01" (browser time zone)
formatRelativeTime(iso: string, now?: Date): string     // → "2 minutes ago" (< 24 h; older → formatDateTime)
formatMoney(money: Money): string                       // { amountMicros: 35000, currency: 'EUR' } → "€0.035"
```

ACs and messages reference these names (e.g. "`{max}` formatted with `formatBytes`").

## F8 — Definition of Done wording (W8)

Replace SPEC §16 with:

> A feature is done when:
> - [ ] Its specs passed **that day's spec check** with no open findings (AGENTS.md §1a).
> - [ ] Contract changed first if needed; generated code untouched; `ci/contract-check` passes.
> - [ ] Every AC it implements has status `done` and at least one passing test whose title starts with the AC ID; `pnpm trace` passes T1–T6.
> - [ ] Its e2e journeys (§10) pass on Chromium against the gateway.
> - [ ] Loading, empty, error and no-permission states exist, each with a story.
> - [ ] All user-facing text comes from message catalogues; none of it is marked `draft`.
> - [ ] Keyboard and screen-reader checks pass; axe reports no serious or critical issues.
> - [ ] `ci/size` passes on the production build, and `ci/no-test-hooks` passes.
> - [ ] No new lint suppressions without a `reason:` comment.
> - [ ] The PR lists **Implements:** IDs and notes agent mistakes caught (for `docs/agent-log.md`).
> - [ ] CI green with zero retries.

## F9 — Per-day spec check in AGENTS.md (W9)

Add as **§1a** of AGENTS.md, after "Before you change anything":

> ### 1a. Before starting a day's milestone
> 1. Run the `spec-reviewer` pass on **only** the specs scheduled for that day (SPEC.md §14), plus deferred review items for those areas (`docs/decisions/`, "Still deferred").
> 2. Report findings with IDs. Classify each as **product decision** (the human decides), **contradiction** (the human picks which side wins), or **missing detail** (you may propose wording).
> 3. **Stop and wait.** Don't resolve product decisions or contradictions yourself.
> 4. Apply the human's decisions, record them in a dated `docs/decisions/` file, then start building.

## F10 — Draft strings review (O9)

Only Rasul can close this one: E6 deliberately keeps the agent from approving its own wording. Review mock-data §10 against this checklist, edit what fails, then remove the `draft` markers:

1. **Says what happened and what to do next.** For example, "Storage quota is full. Free up space or ask an admin to raise the quota."
2. **Plain words,** no internal terms (no "tenant scope", "409", "resource").
3. **Same terms everywhere:** tenant, VM, bucket, quota, plan; "Sign in" / "Sign out" (not "log in").
4. **Sentence case.** Messages end with a full stop; labels and button text don't.
5. **Placeholders** use only the documented params, formatted with the F7 functions.
6. **Buttons are verbs** that name the result: "Suspend tenant", not "OK" or "Yes".

If you paste §10 here, I'll mark the strings that fail the checklist, but the final call stays yours.

## F11 — Where `SessionSnapshot` types come from (W11)

- `Role`, `Permission` and `TenantSummary` come from the **generated contract models**, so the snapshot changes when the contract changes.
- `libs/api-client` exposes them through a dedicated entry point, **`@nimbus/api-client/model`** (`package.json` `exports` → `src/generated/model/index.ts`). It contains types and enum constants only.
- `libs/mf-contract` imports them with **`import type`** only, so it has **no runtime dependency** on the API client. This is enforced by `@typescript-eslint/consistent-type-imports` and a dependency rule in `libs/mf-contract/eslint.config.mjs` that forbids value imports from `@nimbus/api-client`.
- Nx project graph: `mf-contract` → `api-client` (type-only).

---

## F12 — `canOpen` permission and signature (corrects E10)

E10 named `tenant:list`, which doesn't exist. The correct permission is **`tenant:read`**.

```ts
// libs/auth — pure, no I/O
export function canOpen(
  target: { resource: ResourceRef; tenantId: string | null },  // a Task fits as-is
  session: SessionSnapshot,
): string | null;                                              // app-relative URL, or null = plain text
```

| `resource.type` | Returns | Requires |
|---|---|---|
| `tenant` | `/tenants/{id}` | `tenant:read` |
| `vm` | `/compute/{id}`, plus `?tenantId={target.tenantId}` when `session.tenant` is null | `vm:read` |
| `bucket` | `null` | — |

No scope check: the server only sends tasks the user may see (RT-12), and stale links end in the not-found state.

## F13 — Server mode: `NIMBUS_MODE`

mock-api and the gateway read one required variable, **`NIMBUS_MODE`**. Our code never reads `NODE_ENV`.

| `NIMBUS_MODE` | Used by | Test endpoints | Latency | Reboot failure rate | Seed |
|---|---|---|---|---|---|
| `dev` | `pnpm dev` | on | 150 ms | 0.1 | 42 |
| `e2e` | CI and local e2e | on | 0 | 0 | 42 |
| `demo` | preview deploy, interview demo | **off** | 150 ms | 0.1 | 42 |

- Missing or invalid → the server refuses to start with a clear error.
- The mode sets defaults only. `MOCK_LATENCY_MS`, `MOCK_FAILURE_RATE`, `MOCK_SEED` and `MOCK_SESSION_TTL_S` override them.
- Config is validated with Zod at start-up and logged once.
- It pairs with the frontend build modes (E1): `dev` ↔ `development`, `e2e` ↔ `e2e`, `demo` ↔ `production`.
- E3's "test endpoints only in development and e2e" now means `NIMBUS_MODE` ∈ {`dev`, `e2e`}.

## F14 — Drawer URL parameters

- **Tenant drawer:** `/tenants/:tenantId?tab=overview|quotas|activity`. The default `overview` is left out of the URL. List filters stay in the query while the drawer is open (`/tenants/t_acme?status=active&tab=quotas`). `tenantId` is never a query parameter on `/tenants`.
- **VM drawer:** `/compute/:vmId`, with no `tab`.
- **`?tenantId=`** exists only on `/compute` and `/storage`, for admins:
  - Ignored and removed (replace) for tenant roles.
  - If an admin opens `/compute/vm_01` without it, compute adds it from `vm.tenantId` (replace).
  - A value that doesn't match the ID format is treated as missing.
- **History:**

  | Action | History |
  |---|---|
  | Open drawer | push |
  | Switch tab | replace |
  | Close with ✕ | push the list URL without `tab` |
  | URL corrections (invalid `tab`, adding or removing `tenantId`) | replace |

- Unknown query parameters are kept and ignored.
- **`RemoteContext.navigate`** becomes `navigate(to: string, options?: { replace?: boolean }): void`.

**New ACs**
- **F14.a** (SPEC-TEN-3) Switching drawer tabs doesn't add history entries; *Back* closes the drawer.
- **F14.b** (SPEC-TEN-3) `/tenants/t_acme?tab=bogus` shows Overview and the URL becomes `/tenants/t_acme`.
- **F14.c** (SPEC-CMP-5) A provider_admin opening `/compute/vm_01` without `tenantId` ends on `/compute/vm_01?tenantId=t_acme` with the list for `acme` behind the drawer.
- **F14.d** (SPEC-CMP-4) A tenant_admin opening `/compute?tenantId=t_other` sees their own VMs, and `tenantId` is removed from the URL.

---

## Agent prompt

> Read `docs/decisions/SPEC-REVIEW-v1.5-decisions.md` and apply F1–F9 and F11–F14 exactly. Skip F10 (the human does it). Change nothing else. If a decision conflicts with the current files, stop and list the conflict.
> - New ACs: next free number in the named spec, status `planned`; record the `F<n>.<letter>` mapping in the SPEC.md v1.5 changelog.
> - F5: if mock-data's current VM mapping differs, switch to F5's and update every reference.
> - F6: if AC-TEN-3.10 isn't the quota-then-storage e2e check, report what it is before naming a role.
>
> Finish with a per-decision summary, the ID mapping, and conflicts found. Don't run a spec review; the next one is the Day 1 check (F9).
