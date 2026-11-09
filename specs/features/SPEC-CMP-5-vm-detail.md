---
id: SPEC-CMP-5
title: "VM detail (Vue remote)"
area: compute
day: 6
implements: [US-5.1, US-6.1]
---

# SPEC-CMP-5 — VM detail (Vue remote) [MVP]

Shared rules: [mf-contract](../shared/mf-contract.md) · [realtime](../shared/realtime.md) · [rbac](../shared/rbac.md) · [url-conventions](../shared/url-conventions.md) · [messages-and-format](../shared/messages-and-format.md)

**Implements:** US-5.1, US-6.1 · REQ-5

**Behaviour**
- Route `/compute/:vmId` (plus `?tenantId=` for provider/reseller admins, SPEC-CMP-4). A drawer over the VM list. URL and history rules: [url-conventions](../shared/url-conventions.md).
- Overview: name, status, vCPU, memory, disk, IP, image, created.
- Current task with progress (from compute's own cache, RT-4).
- Recent tasks: `listTasks?resourceId=` in compute's own cache.

**States:** loading, not found (`errors.NOT_FOUND` "This item no longer exists."), error.

**Acceptance criteria**

| ID | Criterion | Status |
|---|---|---|
| **AC-CMP-5.1** | `/compute/vm_01` opens the drawer for web-01, including after a reload. | `done` |
| **AC-CMP-5.2** | A non-existent VM ID shows `errors.NOT_FOUND` "This item no longer exists." | `done` |
| **AC-CMP-5.3** | A running task's progress updates live in the drawer. | `done` |
| **AC-CMP-5.4** | A provider_admin opening `/compute/vm_01` without `tenantId` ends on `/compute/vm_01?tenantId=t_acme` with the list for `acme` behind the drawer. | `done` |
