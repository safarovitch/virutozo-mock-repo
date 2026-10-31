# URL conventions (drawers, `tenantId`, history)

Shared spec block (moved from SPEC.md [url-conventions](./url-conventions.md)). Used by SPEC-TEN-3, SPEC-CMP-4, SPEC-CMP-5, SPEC-STO-3.


- **Tenant drawer:** `/tenants/:tenantId?tab=…`. The path segment says which tenant; `tenantId` is never a query parameter on `/tenants`. `tab` is `overview`, `quotas` or `activity`; the default is `overview`, and the parameter is left out of the URL when it's the default. List filters stay in the URL while the drawer is open (e.g. `/tenants/t_acme?status=active&sort=-createdAt&tab=quotas`), so closing the drawer returns to the same filtered list.
- **VM drawer:** `/compute/:vmId`, with no `tab` (it has sections, not tabs).
- **`tenantId`** exists only on `/compute` and `/storage`, for admins (SPEC-CMP-4, SPEC-STO-3):
  - for tenant roles it's ignored and removed from the URL;
  - if an admin opens `/compute/vm_01` without it, compute loads the VM, then adds `?tenantId=` from `vm.tenantId`, so the list behind the drawer matches;
  - if it doesn't match the ID format (contract `ResourceId`), it's treated as missing and the picker is shown.
- Unknown parameters are kept, but have no effect.

| Action | History |
|---|---|
| Open drawer | push (Back closes it) |
| Switch tab | replace (Back doesn't step through tabs) |
| Close with ✕ | push the list URL without `tab` |
| URL corrections (invalid `tab`, adding or removing `tenantId`) | replace |
