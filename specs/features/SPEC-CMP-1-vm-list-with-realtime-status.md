---
id: SPEC-CMP-1
title: "VM list with realtime status (Vue remote)"
area: compute
day: 6
implements: [US-5.1]
---

# SPEC-CMP-1 — VM list with realtime status (Vue remote) [MVP]

Shared rules: [mf-contract](../shared/mf-contract.md) · [realtime](../shared/realtime.md) · [rbac](../shared/rbac.md) · [url-conventions](../shared/url-conventions.md) · [messages-and-format](../shared/messages-and-format.md)

**Implements:** US-5.1 · REQ-5

**Behaviour**
- Table: Name, Status (badge with icon + text, never colour alone), vCPU, Memory, IP, Actions.
- Data from `listVms`; live updates from `server:vm.updated` bus events (WS-3, [realtime](../shared/realtime.md)).
- Transitional statuses (`starting`, `stopping`, `rebooting`) show a spinner and the linked task's progress %. On mount, compute fetches `getTask` for each VM's `activeTaskId` into its own cache (RT-4).

**Acceptance criteria**

| ID | Criterion | Status |
|---|---|---|
| **AC-CMP-1.1** | Given a `vm.updated` event changes VM status to `stopped`, then the row updates within one animation frame of the event being processed, with no network request (unit test, `vi.useFakeTimers({ toFake: ['requestAnimationFrame'] })`). | `done` |
| **AC-CMP-1.2** | Given 50 `vm.updated` events arrive within one animation frame, then they result in **one** cache write (spy on `setQueriesData`; fake `requestAnimationFrame`). | `done` |
| **AC-CMP-1.3** | Given the WS connection drops and reconnects, then the VM list is refetched once (WS-2). | `done` |
| **AC-CMP-1.4** | Status changes are announced politely to screen readers via an `aria-live="polite"` region (`compute.vmNowStatus` "web-01 is now stopped."), at most one announcement per second. | `done` |
| **AC-CMP-1.5** | Mounting compute while a VM has an `activeTaskId` shows that task's current progress within one `getTask` call. | `done` |
