---
name: add-table-page
description: Build or extend a list page in a remote (a table of tenants, buckets, VMs…): generated hook, DataTable, URL state, all five states, RBAC gates and a test per AC. Use for "add a column", "add a list page", "add a filter".
---

# Add a table page

Reference implementations: `apps/tenants/src/TenantList.tsx` (virtualised, sort, filters), `apps/storage/src/StorageArea.tsx` (simple list, admin picker), `apps/compute/src/VmList.vue` (Vue).

1. **IDs and contract.** Find the AC IDs. Read the list operation in `contracts/main.tsp` (`x-permission`, query params, the model's fields). A new field (e.g. `region`) is a contract change first: use the `contract-change` skill, then come back.
2. **Data.** In the area's `src/data.ts`: `useInfiniteQuery` with `queryKey: getListXQueryKey(params)` and `queryFn` calling the generated function from `@nimbus/api-client/react` (or `/vue`). Never a hand-written key or `fetch` (lint: `nimbus/no-handwritten-query-key`, `nimbus/no-direct-fetch`). Events patch the cache through one helper (`patchTenant`, `upsertBucket`).
3. **URL state.** Filters, sort and selection live in the URL (`src/url.ts`: `parsePath` / `toPath`); push for filter changes, `replace` for corrections (specs/shared/url-conventions.md).
4. **Columns.** `dataTableColumns<T>()` from `@nimbus/ui-kit`; headers from the catalogue (`src/messages/en.ts`, plus a `draft` row in `specs/mock-data.md` §10). Format with `@nimbus/format` (`formatBytes`, `formatCount`, `formatDateTime`). Status is text + `StatusBadge`, never colour alone.
5. **Five states (H6):** loading (`loading` prop / `Skeleton`), empty (`EmptyState`, with the create action only with its permission), error (`ErrorState` with the mapped `messageFor(problem)` and Retry; no Retry for 404), no permission (the area root shows the 403 state without the read permission), plus the normal list. Each gets a story in `*.stories.tsx`.
6. **RBAC.** `useCan(Permission['x:y'])` / `can(session, …)`; actions without permission are hidden or disabled with `rbac.disabledTooltip` (RBAC-4). Never compare roles.
7. **Tests.** Component tests on the area's fake API (`src/testing/fake-api.ts`, extend it for new fields) with titles `AC-…: …`; `stubLayout()` in jsdom for virtualised tables. One e2e journey if the AC is about the real stack. Set the AC status in the spec.
8. **Run** `pnpm nx run-many -t lint typecheck test -p <area>` and, for e2e, `pnpm e2e --grep "AC-…"`.
