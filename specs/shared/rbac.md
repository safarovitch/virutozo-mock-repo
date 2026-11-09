# Roles & permissions (RBAC)

Shared spec block (moved from SPEC.md §5). Rule IDs RBAC-1…RBAC-6 are defined only here.


## Permission strings
Permissions are strings returned by `GET /me`. The UI **never** checks role names, only permissions (`RBAC-1`).

```
tenant:read  tenant:create  tenant:update  tenant:suspend
quota:read   quota:update
vm:read      vm:operate     vm:create
bucket:read  bucket:create  bucket:delete
task:read
plan:read
vitals:read
```

## Matrix

| Permission | provider_admin | reseller_admin | tenant_admin | tenant_viewer |
|---|:-:|:-:|:-:|:-:|
| tenant:read | ✅ all | ✅ own | — | — |
| tenant:create | ✅ | ✅ | — | — |
| tenant:update | ✅ | ✅ own | — | — |
| tenant:suspend | ✅ | — | — | — |
| quota:read | ✅ | ✅ | ✅ | ✅ |
| quota:update | ✅ | ✅ own | — | — |
| vm:read | ✅ | ✅ | ✅ | ✅ |
| vm:operate | ✅ | — | ✅ | — |
| vm:create | — | — | ✅ | — |
| bucket:read | ✅ | ✅ | ✅ | ✅ |
| bucket:create / delete | — | — | ✅ | — |
| task:read | ✅ | ✅ | ✅ | ✅ |
| plan:read | ✅ | ✅ | — | — |
| vitals:read | ✅ | — | — | — |

Scope (all / own) is enforced by the **API**. The UI only hides or disables; it is never the security boundary (`RBAC-2`).

The Tenants area (`/tenants`) is the provider/reseller management area, so tenant roles don't get `tenant:read`. They reach their own tenant's data through `vm:read`, `bucket:read` and `quota:read`, scoped by the server to `me.tenant.id`, and see a read-only summary of their tenant in `Me.tenant` (SPEC-SHL-8). Their home area is **`/compute`** (SPEC-SHL-1).

## UI rules
- **RBAC-1** Use `can('tenant:suspend')` / `<Can permission="…">` / `v-can="'…'"` — never compare role names.
- **RBAC-2** The UI is not a security boundary. Every mutating API call can still return `403`; handle it (`AC-SHL-3.2`).
- **RBAC-3** Navigation items are hidden when the user lacks the area's `*:read` permission.
- **RBAC-4** Actions the user can't perform are **hidden** in toolbars; in contexts where the user should know the action exists (e.g. row menu), they're **disabled with a tooltip** `rbac.disabledTooltip` "You don't have permission to {action}.", with `{action}` from the `actions.*` keys (`specs/mock-data.md` SPEC.md §10).
- **RBAC-5** Directly visiting a URL without permission shows a *403 – No access* page, not a blank screen.
- **RBAC-6** Permission string constants come from the generated contract enum `Permission`; hard-coded strings are a lint error (`nimbus/no-raw-permission`).
