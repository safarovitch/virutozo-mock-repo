# apps/storage — local guide

**Purpose:** React remote for the Storage area. Exposes `./mount` (ADR-0002); features arrive with SPEC-STO-1…3 (Day 8).

**Framework and key libraries:** React 19 (shared singleton with the shell), `@module-federation/vite` (remote, `remoteEntry.js`).

**Owns:** its own `QueryClient` and caches (MF-2, RT-4) once data arrives; publishes only `RemotePublishable` events on its bus scope.

**Local commands:** `pnpm nx serve storage` (4202) · `pnpm nx run storage:build` (base `/remotes/storage/`) · `pnpm nx run storageypecheck`.

**Local pitfalls**
- `base` is `/remotes/storage/` for builds and `/` in dev; the gateway and `config/remotes.*.json` depend on it.
- Shared singletons come only from `tools/mf/shared.ts`; don't add a `shared` list here (H11).
- `mount()` must return a working `update(ctx)`; never remount on context changes.
