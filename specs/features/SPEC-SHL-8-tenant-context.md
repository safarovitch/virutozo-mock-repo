---
id: SPEC-SHL-8
title: "Tenant context"
area: shell
day: 6
implements: [US-1.2]
---

# SPEC-SHL-8 — Tenant context [MVP]

Shared rules: [mf-contract](../shared/mf-contract.md) · [realtime](../shared/realtime.md) · [rbac](../shared/rbac.md) · [url-conventions](../shared/url-conventions.md) · [messages-and-format](../shared/messages-and-format.md)

**Implements:** US-1.2 · SPEC.md §1.3 (tenant_viewer persona)

**Behaviour**
- Tenant roles have no `tenant:read` ([rbac](../shared/rbac.md)). Instead `Me.tenant` carries a read-only `TenantSummary` (`id`, `displayName`, `planName`, `status`).
- A tenant context bar in the shell header for users with `me.tenant`: `shell.tenantContext` "{displayName} · {planName} · {status}", the status shown as a badge.
- `server:tenant.updated` for the user's own tenant patches `me.tenant.status` in the shell cache.
- Suspended tenant: a global banner `tenantStatus.suspendedBanner` "This tenant is suspended. You can view resources but can't change them." All mutating actions are disabled with that text as tooltip. The server enforces it too: changes to the tenant's VMs, buckets and quotas return 409 `TENANT_SUSPENDED` (`errors.TENANT_SUSPENDED` "This tenant is suspended, so changes are disabled.").
- Tenant roles don't see the reseller, plan limits beyond their own quotas, pricing, or other tenants.

**Acceptance criteria**

| ID | Criterion | Status |
|---|---|---|
| **AC-SHL-8.1** | A tenant_viewer sees "Acme Corporation · Business · Active" in the header. | `done` |
| **AC-SHL-8.2** | When their tenant becomes suspended (`tenant.updated`), the banner appears and VM and bucket actions are disabled without a reload. | `in-progress` |
