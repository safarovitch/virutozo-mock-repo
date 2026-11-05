---
id: SPEC-CMP-2
title: "VM actions as long-running tasks"
area: compute
day: 6
implements: [US-6.1]
---

# SPEC-CMP-2 — VM actions as long-running tasks [MVP]

Shared rules: [mf-contract](../shared/mf-contract.md) · [realtime](../shared/realtime.md) · [rbac](../shared/rbac.md) · [url-conventions](../shared/url-conventions.md) · [messages-and-format](../shared/messages-and-format.md)

**Implements:** US-6.1 · REQ-6

**Behaviour**
- Actions per status: `stopped` → Start; `running` → Stop, Reboot; transitional → all disabled.
- `error` → Start, Stop and Reboot disabled, with tooltip `compute.vmInError` "No actions are available while this VM is in error." (D6-03).
- *Stop* asks for confirmation. Start and Reboot do not (except for a provider admin acting on another tenant, SPEC-CMP-4).
- Action → `runVmAction` → `202 Task` → publish `task:started` → the *Status* cell (and the drawer's *Current task*) shows the transitional status, a spinner and the task's % until it ends; the buttons stay in place, disabled (AC-CMP-2.4) → toast on success/failure (D6-02).
- `409 VM_BUSY` → toast `errors.VM_BUSY` "web-01 is busy with another operation."

**Permissions:** `vm:operate`. Without it, action buttons are hidden (toolbar context, RBAC-4).

**Acceptance criteria**

| ID | Criterion | Status |
|---|---|---|
| **AC-CMP-2.1** | Given a running VM, when the user clicks *Reboot*, then the status becomes `rebooting` immediately (optimistic) and progress % updates from task events. | `done` |
| **AC-CMP-2.2** | Given the task fails, then status reverts to the server's latest value and a toast shows the error. | `done` |
| **AC-CMP-2.3** | Given `tenant_viewer`, then no action buttons are rendered. | `done` |
| **AC-CMP-2.4** | While a VM has an active task, all its actions are disabled with tooltip `compute.operationInProgress` "Operation in progress". | `done` |
| **AC-CMP-2.5** | *Stop* asks for confirmation (`compute.confirmStop.title` "Stop web-01?"); *Cancel* sends no request. (Added Day 6 from the behaviour above, A6-07.) | `done` |
| **AC-CMP-2.6** | A `409 VM_BUSY` from a stale row rolls back the optimistic status, shows `errors.VM_BUSY` "web-01 is busy with another operation." and fetches the VM again (D6-09). (Added Day 6, A6-07.) | `done` |
| **AC-CMP-2.7** | A VM in `error` has *Start*, *Stop* and *Reboot* disabled with tooltip `compute.vmInError` (D6-03). (Added Day 6, A6-07.) | `done` |
