---
id: SPEC-TEN-4
title: "Suspend / resume tenant"
area: tenants
day: 7
implements: [US-4.1]
---

# SPEC-TEN-4 — Suspend / resume tenant [MVP]

Shared rules: [mf-contract](../shared/mf-contract.md) · [realtime](../shared/realtime.md) · [rbac](../shared/rbac.md) · [url-conventions](../shared/url-conventions.md) · [messages-and-format](../shared/messages-and-format.md)

**Implements:** US-4.1 · REQ-4

**Behaviour**
- Row menu and drawer show *Suspend* (`tenant:suspend`) for active tenants and *Resume* for suspended ones.
- Suspend opens a danger dialog explaining consequences; the user must type the tenant name to enable *Suspend tenant*.
- Calls `suspendTenant` → `202` with a task → publishes `task:started` ([realtime](../shared/realtime.md)). The row shows status `provisioning` with spinner until `tenant.updated` arrives.

**Acceptance criteria**

| ID | Criterion | Status |
|---|---|---|
| **AC-TEN-4.1** | The confirm button is disabled until the typed text exactly matches the tenant name. | `planned` |
| **AC-TEN-4.2** | After confirming, a task appears in the task center and the row status updates when the task succeeds. | `planned` |
| **AC-TEN-4.3** | If the task fails (e2e: `POST /api/__test/fail-next-task { "kind": "tenant.suspend", "code": "INTERNAL" }`), the row reverts to `active` and a toast shows the mapped message for the task's `error.code` (MSG-3), e.g. `errors.INTERNAL` "Something went wrong on our side. Try again." | `planned` |
| **AC-TEN-4.4** | A `reseller_admin` doesn't see *Suspend* enabled: it's disabled with tooltip `rbac.disabledTooltip` + `actions.suspendTenant` "You don't have permission to suspend tenants." | `planned` |
| **AC-TEN-4.5** | Suspending a tenant shows its task in the task center immediately. | `planned` |
