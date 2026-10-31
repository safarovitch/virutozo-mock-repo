---
id: SPEC-SHL-9
title: "Messages"
area: shell
day: 3
implements: []
---

# SPEC-SHL-9 — Messages [MVP]

Shared rules: [mf-contract](../shared/mf-contract.md) · [realtime](../shared/realtime.md) · [rbac](../shared/rbac.md) · [url-conventions](../shared/url-conventions.md) · [messages-and-format](../shared/messages-and-format.md)

**Implements:** MSG-1…4 ([messages-and-format](../shared/messages-and-format.md))

**Acceptance criteria**

| ID | Criterion | Status |
|---|---|---|
| **AC-SHL-9.1** | Every `ErrorCode` has a message (unit test over the enum). | `planned` |
| **AC-SHL-9.2** | An unknown code shows `errors.INTERNAL` "Something went wrong on our side. Try again." | `planned` |
| **AC-SHL-9.3** | `QUOTA_EXCEEDS_PLAN` with `{ resource: "storage", plan: "Starter", max: 107374182400 }` shows `errors.QUOTA_EXCEEDS_PLAN.storage` "Starter allows up to 100 GiB." | `planned` |
