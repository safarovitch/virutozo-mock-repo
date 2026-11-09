---
id: SPEC-SHL-2
title: "Navigation and layout"
area: shell
day: 3
implements: [US-1.2]
---

# SPEC-SHL-2 — Navigation and layout [MVP]

Shared rules: [mf-contract](../shared/mf-contract.md) · [realtime](../shared/realtime.md) · [rbac](../shared/rbac.md) · [url-conventions](../shared/url-conventions.md) · [messages-and-format](../shared/messages-and-format.md)

**Implements:** US-1.2 · RBAC-3

**Behaviour**
- Left sidebar: Tenants, Compute, Storage, (Plans, stretch). Header: user menu (a button with the user's name; its menu shows the role as plain text and *Sign out*, D3-01), tenant context bar (SPEC-SHL-8), connection indicator (WS-4, WS-7), task center button with running-task count badge.
- Items are hidden if the user lacks the area's `*:read` permission.

**Acceptance criteria**

| ID | Criterion | Status |
|---|---|---|
| **AC-SHL-2.1** | Given a `tenant_admin`, then the sidebar shows Compute and Storage, and not Tenants. | `done` |
| **AC-SHL-2.2** | Given 2 running tasks, then the task center badge shows "2" and has accessible label `shell.runningTasks_other` "2 running tasks". | `done` |
| **AC-SHL-2.3** | All sidebar items are reachable and operable by keyboard; the current item has `aria-current="page"`. | `done` |
