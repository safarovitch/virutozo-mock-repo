---
id: SPEC-SHL-3
title: "Permission handling"
area: shell
day: 3
implements: [US-1.2]
---

# SPEC-SHL-3 — Permission handling [MVP]

Shared rules: [mf-contract](../shared/mf-contract.md) · [realtime](../shared/realtime.md) · [rbac](../shared/rbac.md) · [url-conventions](../shared/url-conventions.md) · [messages-and-format](../shared/messages-and-format.md)

**Implements:** US-1.2 · RBAC-1…6

**Acceptance criteria**

| ID | Criterion | Status |
|---|---|---|
| **AC-SHL-3.1** | Given a user without `tenant:read`, when they open `/tenants` directly, then the `shell.noAccess.title` "403 – No access" page is shown with a link to their home area. | `done` |
| **AC-SHL-3.2** | Given the UI shows an action but the API returns 403, then a toast says `errors.FORBIDDEN` "You don't have permission to do this." and no state changes. | `in-progress` |
| **AC-SHL-3.3** | `<Can>` (React) and `v-can` (Vue) render nothing when the permission is missing and do not flash content before `/me` resolves. | `done` |
