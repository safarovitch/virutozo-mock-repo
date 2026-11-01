---
id: SPEC-TEN-3
title: "Tenant detail drawer"
area: tenants
day: 5
implements: [US-2.1, US-9.1]
---

# SPEC-TEN-3 — Tenant detail drawer [MVP]

Shared rules: [mf-contract](../shared/mf-contract.md) · [realtime](../shared/realtime.md) · [rbac](../shared/rbac.md) · [url-conventions](../shared/url-conventions.md) · [messages-and-format](../shared/messages-and-format.md)

**Implements:** US-2.1, US-9.1

**Behaviour:** Side drawer with Overview (fields), Quotas (editable by `quota:update`; read-only text with tooltip `tenantStatus.suspendedTooltip` while the tenant is suspended, when *Resume* is the drawer's primary action, `tenant:suspend`), and Activity (recent tasks for this tenant, from `listTasks?resourceId=` cached in the tenants area, RT-4). URL `/tenants/:tenantId?tab=overview|quotas|activity` so it's linkable ([url-conventions](../shared/url-conventions.md)). The drawer has *View VMs* (`/compute?tenantId=<id>`) and *View buckets* (`/storage?tenantId=<id>`) links (SPEC-CMP-4, SPEC-STO-3). Overview is read-only (`tenant:update` isn't used, D5-13). Both storage (whole GiB) and VM quotas are editable; saves are optimistic with rollback (D5-14). *Resume* arrives with SPEC-TEN-4 on Day 7 (D5-03).

**Acceptance criteria**

| ID | Criterion | Status |
|---|---|---|
| **AC-TEN-3.1** | Opening `/tenants/t_acme` directly shows the list with the drawer open for that tenant. | `done` |
| **AC-TEN-3.2** | Given `quota:update`, when the user lowers storage quota below current usage, then save is blocked with `errors.QUOTA_BELOW_USAGE.storage` "Storage quota can't be lower than current usage ({used})." with `{used}` formatted by `formatBytes` (e.g. "(840 GiB)"). | `done` |
| **AC-TEN-3.3** | Given a successful quota update, then the list row's storage bar updates (optimistic update with rollback on error). | `done` |
| **AC-TEN-3.4** | Given no `quota:update`, then quota fields are read-only text, not disabled inputs. | `done` |
| **AC-TEN-3.6** | The drawer's Activity list shows a new suspend task and its progress live. | `done` |
| **AC-TEN-3.7** | Opening `/tenants/<non-existent id>` shows the drawer's not-found state with `errors.NOT_FOUND` "This item no longer exists." | `done` |
| **AC-TEN-3.8** | `updateQuotas` emits `quota.updated` with the new values (mock-api integration test). | `done` |
| **AC-TEN-3.9** | A `server:quota.updated` on a fake bus updates the storage usage card with zero HTTP calls (storage component test; MSW asserts none). | `planned` |
| **AC-TEN-3.10** | Given a reseller_admin, after saving a quota in the tenant drawer, opening `/storage?tenantId=t_acme` shows the new quota (e2e). | `planned` |
| **AC-TEN-3.11** | For a suspended tenant, quota fields are read-only and *Resume* is shown. | `in-progress` |
| **AC-TEN-3.12** | Switching drawer tabs doesn't add history entries; *Back* closes the drawer. | `done` |
| **AC-TEN-3.13** | `/tenants/t_acme?tab=bogus` shows Overview and the URL becomes `/tenants/t_acme`. | `done` |
