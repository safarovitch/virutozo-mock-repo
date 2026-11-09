# libs/auth — local guide

**Purpose:** permission checks for every area (specs/shared/rbac.md): `can`, `permittedAreas`, `homeArea`, `permissionForPath`, `safeReturnTo`, `returnToFor`, `loginUrl`; `<Can>` / `useCan` / `SessionProvider` (`@nimbus/auth/react`); `createCanDirective` for `v-can` (`@nimbus/auth/vue`).

**Framework and key libraries:** none in the core; React and Vue are optional peers of their entry points.

**Owns:** the area order (Tenants → Compute → Storage) and each area's `*:read` permission; the `returnTo` validation (AC-SHL-1.8).

**Local commands:** `pnpm nx run auth:test` · `pnpm nx run auth:typecheck`.

**Local pitfalls**
- The core stays pure (no I/O, no framework): the shell, React remotes and the Vue remote all use it.
- Pass `Permission[...]` values from `@nimbus/api-client/model`, never string literals (RBAC-6).
- `v-can` runs once per mount: the session can't change while a remote is mounted (RT-10). Use `can()` in `computed` when you need reactivity.
- `safeReturnTo` must keep rejecting every AC-SHL-1.8 input; add a case to its test before changing it.
