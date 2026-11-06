# apps/compute — local guide

**Purpose:** Vue 3 remote for the Compute area. Exposes `./mount` (ADR-0002): VM list (SPEC-CMP-1), actions (SPEC-CMP-2) and the drawer (SPEC-CMP-5) since Day 6, and the admin view (SPEC-CMP-4): tenant picker (`TenantPicker.vue`), "Acting on tenant" and the suspended-tenant banner.

**Framework and key libraries:** Vue 3.5 (`<script setup lang="ts">`), `@tanstack/vue-query` 5 with generated clients from `@nimbus/api-client/vue`, Pinia 3 for UI state only (`src/ui-store.ts`), `@nimbus/ui-kit-vue`. Vue and Vue Query are bundled here, not shared (ADR-0001 R2). Storybook 10 on port 6010.

**Owns:** its own `QueryClient` per mount (`src/data.ts`, MF-2, RT-4); server events batched per frame (`subscribeComputeEvents`, RT-5); its catalogue `src/messages/en.ts`; the URL below `/compute` (`src/url.ts`); the reactive context `CTX_KEY` and bus `BUS_KEY`.

**Local commands:** `pnpm nx serve compute` (4203) · `pnpm nx run compute:typecheck` (vue-tsc) · `pnpm nx run compute:test` (jsdom, fake API) · `pnpm nx run compute:build` · `pnpm --filter @nimbus/compute storybook`.

**Local pitfalls**
- Components read the context with `inject(CTX_KEY)` (`useCtx()`); `update(ctx)` only swaps the `shallowRef`. In templates refs are unwrapped.
- `getListVmsQueryKey()` (`['vms']`) is the prefix of the list **and** every `getVm`: write VMs only through `patchVms`, which handles both shapes in one `setQueriesData` (AC-CMP-1.2).
- `getTask` has `staleTime: Infinity`: events keep it current (`applyTask` + `mergeTask`); never refetch it by hand.
- `NuiButton`: `disabledReason` keeps the button focusable with a tooltip; `disabled` alone is a plain disabled button (used for actions that don't apply to the status).
- The suspended banner text is also every action's tooltip: in tests scope it to `role="status"`.
- No jest-dom here: Vitest's DOM matcher types exist but the matchers don't run. Assert on `textContent` / `getAttribute`; tooltips via the `description()` helper in the tests.
- Tests and stories use `src/testing/fake-api.ts`, never the real API; mount with `renderArea()` (`src/testing/render.ts`).
- Subscribe only through `useBusEvent` or `subscribeComputeEvents` inside setup with `onUnmounted` cleanup (RT-7, AC-SHL-6.3).
- The app root is `RemoteBoundary.vue` (MF-6): it publishes one fatal `remote:error` and renders nothing further. Don't add `app.config.errorHandler`; that would log a second entry.
- A component that must throw for tests throws from `setup(): () => null`; a `render()` that only throws fails lint, and `setup(): never` breaks template prop types.
- Admins: the picked tenant's status comes from `getTenant` (patched by `server:tenant.updated`, D8-09) and reaches the buttons through `PICKED_SUSPENDED_KEY`; `useActionRules().blockedReason` is the only place that decides why every action is blocked. A 404 list (foreign `tenantId`) has no Retry (D8-08).
