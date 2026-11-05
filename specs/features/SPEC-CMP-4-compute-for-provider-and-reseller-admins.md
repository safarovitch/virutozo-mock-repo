---
id: SPEC-CMP-4
title: "Compute for provider and reseller admins"
area: compute
day: 8
implements: []
---

# SPEC-CMP-4 — Compute for provider and reseller admins [MVP]

Shared rules: [mf-contract](../shared/mf-contract.md) · [realtime](../shared/realtime.md) · [rbac](../shared/rbac.md) · [url-conventions](../shared/url-conventions.md) · [messages-and-format](../shared/messages-and-format.md)

**Implements:** REQ-5, REQ-6 · [rbac](../shared/rbac.md)

**Behaviour**
- For users with `me.tenant === null`, Compute shows a searchable tenant combobox (`listTenants`, server-scoped). The selection is in the URL (`?tenantId=t_acme`; rules in [url-conventions](../shared/url-conventions.md)).
- Before a choice: empty state `compute.chooseTenant` "Choose a tenant to see its virtual machines."
- Actions follow the RBAC matrix unchanged: a provider_admin may operate VMs; a context line `compute.actingOnTenant` "Acting on tenant {displayName}" is shown, and **every** VM action asks for confirmation naming the tenant. A reseller_admin is read-only.
- Server scoping: a `tenantId` outside the caller's scope returns 404 `NOT_FOUND`; provider/reseller calls without `tenantId` return 422 `VALIDATION_FAILED`.
- **Suspended tenant picked:** a suspended tenant's resources are read-only for **everyone**, including provider_admin; to make changes, an admin resumes the tenant first. The server returns 409 `TENANT_SUSPENDED` for VM actions, bucket changes and quota updates on a suspended tenant, whoever calls. Compute (and Storage, SPEC-STO-3) shows an in-area banner above the table (not the global tenant-role banner of SPEC-SHL-8), `role="status"`: `tenantStatus.suspendedAdminBanner` "{tenant} is suspended. Resume it to make changes.", plus an *Open tenant* link to `/tenants/{id}` when `canOpen` allows it (`tenant:read`). All mutating actions for that tenant are disabled with tooltip `tenantStatus.suspendedTooltip` "Changes are disabled while this tenant is suspended." Tenant status comes from the area's own cached `listTenants` / `getTenant` data, updated by `server:tenant.updated` (RT-12), so the banner appears or disappears without a reload.

**Acceptance criteria**

| ID | Criterion | Status |
|---|---|---|
| **AC-CMP-4.1** | A provider_admin on `/compute` sees the picker and the empty state. Picking "acme" lists 40 VMs and sets `?tenantId=t_acme`. | `planned` |
| **AC-CMP-4.2** | A reseller_admin sees their tenants' VMs without action buttons. A foreign `tenantId` shows `errors.NOT_FOUND` "This item no longer exists." | `planned` |
| **AC-CMP-4.3** | A provider_admin's *Stop* on a tenant's VM asks for confirmation naming the tenant. | `done` |
| **AC-CMP-4.4** | A provider_admin with a suspended tenant picked sees the `tenantStatus.suspendedAdminBanner` banner, and every VM action is disabled with tooltip `tenantStatus.suspendedTooltip` "Changes are disabled while this tenant is suspended." | `planned` |
| **AC-CMP-4.5** | When that tenant is resumed in another tab, the banner disappears and actions are enabled without a reload. | `planned` |
| **AC-CMP-4.6** | `runVmAction` as provider_admin on a suspended tenant returns 409 `TENANT_SUSPENDED` (mock-api integration test). | `planned` |
| **AC-CMP-4.7** | A tenant_admin opening `/compute?tenantId=t_other` sees their own VMs, and `tenantId` is removed from the URL. | `done` |
