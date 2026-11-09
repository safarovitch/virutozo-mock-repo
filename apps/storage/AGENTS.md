# apps/storage — local guide

**Purpose:** React remote for the Storage area. Exposes `./mount` (ADR-0002): usage card and bucket list (SPEC-STO-1), create/delete (SPEC-STO-2) and the admin view with the tenant picker (SPEC-STO-3).

**Framework and key libraries:** React 19 and `@tanstack/react-query` 5 (shared singletons; the cache isn't), `@nimbus/ui-kit` (DataTable, Dialog, ConfirmDialog, Combobox, UsageBar), generated clients from `@nimbus/api-client/react`, `@module-federation/vite`. Storybook 10 on port 6011.

**Owns:** its own `QueryClient` per mount (`src/data.ts`, MF-2, RT-4): bucket list pages, quotas, the picked tenant and the picker search; server events `bucket.updated`, `quota.updated`, `tenant.updated`; its catalogue `src/messages/en.ts`; the URL below `/storage` (`src/url.ts`, only `?tenantId` for admins); bucket name rules (`src/validate.ts`, from the contract's Zod constants).

**Local commands:** `pnpm nx serve storage` (4202) · `pnpm nx run storage:test` (jsdom component tests on `src/testing/fake-api.ts`) · `pnpm nx run storage:build` (base `/remotes/storage/`) · `pnpm nx run storage:typecheck` · `pnpm --filter @nimbus/storage storybook`.

**Local pitfalls**
- `base` is `/remotes/storage/` for builds and `/` in dev; the gateway and `config/remotes.*.json` depend on it.
- Shared singletons come only from `tools/mf/shared.ts`; don't add a `shared` list here (H11).
- `mount()` must return a working `update(ctx)`; never remount on context changes.
- `mount.tsx` wraps the root in ui-kit's `RemoteErrorBoundary` with `onCaughtError: () => {}`; the shell logs the crash once (MF-6, D7-17). `/__crash` exists only in non-production builds.
- Every write to the bucket lists goes through `upsertBucket` / `removeBucket` (events and mutation responses apply the same idempotent patch, D8-11). A list's tenant is its `tenantId` parameter, or the session's own tenant.
- Admins have no bucket write permissions: never render create/delete for them (D8-12). A suspended tenant disables both with `tenantStatus.suspendedTooltip`.
- *Delete* stays enabled for non-empty buckets; `BUCKET_NOT_EMPTY` shows inline and the dialog stays open (D8-01).
- DataTable renders a `<table>` (not a grid) and virtualises: component tests call `stubLayout()`. The toast region also has `role="alert"`: filter alert queries by text.
