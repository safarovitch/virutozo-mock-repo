---
id: SPEC-STO-3
title: "Storage for provider and reseller admins"
area: storage
day: 8
implements: []
---

# SPEC-STO-3 — Storage for provider and reseller admins [MVP]

Shared rules: [mf-contract](../shared/mf-contract.md) · [realtime](../shared/realtime.md) · [rbac](../shared/rbac.md) · [url-conventions](../shared/url-conventions.md) · [messages-and-format](../shared/messages-and-format.md)

**Implements:** REQ-8 · [rbac](../shared/rbac.md)

**Behaviour**
- For users with `me.tenant === null`, Storage shows the same tenant combobox as SPEC-CMP-4, with the selection in `?tenantId=` (rules in [url-conventions](../shared/url-conventions.md)).
- Before a choice: empty state `storage.chooseTenant` "Choose a tenant to see its buckets."
- The usage card uses `getQuotas(tenantId)` for the picked tenant. Bucket create/delete stays tenant_admin only ([rbac](../shared/rbac.md)).
- Same server scoping as SPEC-CMP-4 (404 outside scope, 422 without `tenantId`), and the same suspended-tenant banner and disabled actions (SPEC-CMP-4).

**Acceptance criteria**

| ID | Criterion | Status |
|---|---|---|
| **AC-STO-3.1** | A provider_admin picking a tenant in Storage sees its buckets and usage card, without create/delete actions. | `planned` |
| **AC-STO-3.2** | A reseller_admin picking one of their tenants sees its buckets and usage card, read-only. | `planned` |
| **AC-STO-3.3** | A foreign `tenantId` in `/storage?tenantId=` shows `errors.NOT_FOUND` "This item no longer exists." | `planned` |
