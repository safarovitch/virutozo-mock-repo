# libs/test-utils — local guide

**Purpose:** test helpers for remotes and the shell (TECH-4): `createFakeBus(source)` (a strict root bus, its scope, `emit`, recorded `published`, `subscriberCount`), `mountRemote(module, ctx)` (mounts any `RemoteModule` the way the shell does) and `testSession(permissions)`.

**Framework and key libraries:** none. Uses `@nimbus/mf-contract`'s real `createRootBus`, so tests exercise the real bus rules.

**Owns:** nothing at runtime. It's a dev dependency only; app code never imports it.

**Local commands:** `pnpm nx run test-utils:test` · `pnpm nx run test-utils:typecheck`.

**Local pitfalls**
- `mountRemote` needs a DOM: mark the test file `// @vitest-environment jsdom`.
- `unmount()` returns the subscriptions left **before** the scope is disposed. Assert `0` to prove the remote cleans up after itself (RT-7), not just that MF-5 does.
- Pass permissions from the generated `Permission` enum values, never role names (H3).
