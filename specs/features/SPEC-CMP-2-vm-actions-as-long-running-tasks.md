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
- *Stop* asks for confirmation. Start and Reboot do not (except for a provider admin acting on another tenant, SPEC-CMP-4).
- Action → `runVmAction` → `202 Task` → publish `task:started` → button area shows progress until task ends → toast on success/failure.
- `409 VM_BUSY` → toast `errors.VM_BUSY` "web-01 is busy with another operation."

**Permissions:** `vm:operate`. Without it, action buttons are hidden (toolbar context, RBAC-4).

**Acceptance criteria**

| ID | Criterion | Status |
|---|---|---|
| **AC-CMP-2.1** | Given a running VM, when the user clicks *Reboot*, then the status becomes `rebooting` immediately (optimistic) and progress % updates from task events. | `planned` |
| **AC-CMP-2.2** | Given the task fails, then status reverts to the server's latest value and a toast shows the error. | `planned` |
| **AC-CMP-2.3** | Given `tenant_viewer`, then no action buttons are rendered. | `planned` |
| **AC-CMP-2.4** | While a VM has an active task, all its actions are disabled with tooltip `compute.operationInProgress` "Operation in progress". | `planned` |
