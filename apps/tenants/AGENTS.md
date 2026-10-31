# apps/tenants — local guide

**Purpose:** React remote for the Tenants area. Exposes `./mount` (ADR-0002); features arrive with SPEC-TEN-1…4 (Days 5 and 7).

**Framework and key libraries:** React 19 (shared singleton with the shell), `@module-federation/vite` (remote, `remoteEntry.js`).

**Owns:** its own `QueryClient` and caches (MF-2, RT-4) once data arrives; publishes only `RemotePublishable` events on its bus scope.

**Local commands:** `pnpm nx serve tenants` (4201) · `pnpm nx run tenants:build` (base `/remotes/tenants/`) · `pnpm nx run tenantsypecheck`.

**Local pitfalls**
- `base` is `/remotes/tenants/` for builds and `/` in dev; the gateway and `config/remotes.*.json` depend on it.
- Shared singletons come only from `tools/mf/shared.ts`; don't add a `shared` list here (H11).
- `mount()` must return a working `update(ctx)`; never remount on context changes.
