# apps/tenants — local guide

**Purpose:** React remote for the Tenants area. Exposes `./mount` (ADR-0002): the list (SPEC-TEN-1) and the drawer (SPEC-TEN-3) from Day 5; wizard and suspend/resume (SPEC-TEN-2, SPEC-TEN-4) on Day 7.

**Framework and key libraries:** React 19 and `@tanstack/react-query` 5 (both shared singletons; the cache isn't), `@nimbus/ui-kit` (DataTable, Drawer), generated clients from `@nimbus/api-client/react`, `@module-federation/vite`. Storybook 10 on port 6009.

**Owns:** its own `QueryClient` per mount (`src/data.ts`, MF-2, RT-4): list pages, tenant, quotas, plans and the drawer's Activity; server events applied per animation frame (RT-5); its catalogue `src/messages/en.ts`; the URL state below `/tenants` (`src/url.ts`).

**Local commands:** `pnpm nx serve tenants` (4201) · `pnpm nx run tenants:test` (jsdom component tests on a fake API) · `pnpm nx run tenants:build` (base `/remotes/tenants/`) · `pnpm --filter @nimbus/tenants storybook`.

**Local pitfalls**
- `base` is `/remotes/tenants/` for builds and `/` in dev; the gateway and `config/remotes.*.json` depend on it.
- Shared singletons come only from `tools/mf/shared.ts`; don't add a `shared` list here (H11).
- `mount()` must return a working `update(ctx)`; never remount on context changes.
- The URL is the state: navigate with `useGo()` (push for filters, sort and opening; `replace` for corrections, tab switches and search-while-typing, D5-04). `toPath` gives "/?q=…": `useGo` drops that slash, or the shell gets `/tenants/?q=…`.
- Query keys only from Orval's helpers; the list prefix is `getListTenantsQueryKey()`. Every write goes through `patchTenant`/`applyQuotas` so list pages and the drawer stay in step.
- Never key a form by server values: an optimistic update remounts it and drops the mutation's `onError` and the user's input.
- The remote bundles its own api-client: `configureApiClient` in `mount.tsx` turns a 401 into `session:expired` for the shell.
- jsdom has no layout: TanStack Virtual sizes from `clientHeight`, so component tests call `stubLayout()` (`src/testing/layout.ts`) or no rows render. Tests and stories use `src/testing/fake-api.ts`, never the real API.
