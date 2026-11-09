---
id: SPEC-TSK-1
title: "Task center"
area: tasks
day: 4
implements: [US-7.1]
---

# SPEC-TSK-1 — Task center [MVP]

Shared rules: [mf-contract](../shared/mf-contract.md) · [realtime](../shared/realtime.md) · [rbac](../shared/rbac.md) · [url-conventions](../shared/url-conventions.md) · [messages-and-format](../shared/messages-and-format.md)

**Implements:** US-7.1 · REQ-7

**Behaviour**
- Header button opens a panel listing tasks: running first (with progress bar), then recent (last 24 h), each with resource name, kind, status, time. The panel is a disclosure under the button (Escape and outside click close it, focus returns to the button) and holds at most the 50 newest tasks of the last 24 h; empty: `tasks.empty` (D4-02).
- The button's badge counts `queued` + `running` tasks; queued tasks are listed under *Running* with a 0 % bar. At 0 there's no badge and the button is named `tasks.title`; otherwise its name adds `shell.runningTasks_one/_other` (D4-01).
- Live updates from `server:task.updated`. Every task upsert, from any source (`listTasks`, `task:started`, `server:task.updated`), goes through `mergeTask` ([realtime](../shared/realtime.md)).
- Owned by the shell; areas publish `task:started` after every task-producing 2xx response ([realtime](../shared/realtime.md)), so a task appears instantly.
- A task's *View resource* link is shown only if `canOpen` (`libs/auth`) returns a URL; otherwise the resource name is plain text.

  ```ts
  // libs/auth — pure function, no I/O
  export function canOpen(
    target: { resource: ResourceRef; tenantId: string | null },  // a Task fits as-is
    session: SessionSnapshot,
  ): string | null;                                              // app-relative URL, or null = render as text
  ```

  | `resource.type` | Returns | Requires |
  |---|---|---|
  | `tenant` | `/tenants/{id}` | `tenant:read` |
  | `vm` | `/compute/{id}`, plus `?tenantId={target.tenantId}` when `session.tenant` is null | `vm:read` |
  | `bucket` | `null` | — |

  `canOpen` doesn't check scope (whether a reseller owns that tenant): the server only sends tasks the user may see (RT-12), and a stale link ends in the "no longer exists" state. Tenant roles have no `tenant:read`, so for them a tenant task's resource name is plain text (SPEC-SHL-8).
- Failed tasks show the mapped message for `task.error.code` (MSG-3).

**Acceptance criteria**

| ID | Criterion | Status |
|---|---|---|
| **AC-TSK-1.1** | A task appears in the task center within 100 ms of the area receiving its 2xx response, whether or not a WebSocket update has already arrived (component test with fake timers). | `done` |
| **AC-TSK-1.2** | Progress bars use `role="progressbar"` with `aria-valuenow`. | `done` |
| **AC-TSK-1.3** | Failed tasks show the mapped message for their error code and, when `canOpen` allows, a *View resource* link. | `done` |
| **AC-TSK-1.4** | A `seq: 2` update followed by `task:started` (`seq: 0`) leaves the task at its `seq: 2` state (unit test). | `done` |
| **AC-TSK-1.5** | A `succeeded` task never changes back to `running`. | `done` |
| **AC-TSK-1.6** | For tenant roles, the `tenant.provision` task shows "acme" as plain text, not a link. | `done` |
| **AC-TSK-1.7** | *View resource* on a VM task opens that VM's drawer (SPEC-CMP-5). | `in-progress` |
