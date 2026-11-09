# tools/ci — local guide

**Purpose:** scripts that CI jobs run on build output: `no-test-hooks.mjs` (ci/no-test-hooks: no `/__crash` or test endpoints in production bundles) and `bundle-closure.mjs` (what a page or remote actually loads, for `.size-limit.mjs` and ci/size, TECH-11).

**Framework and key libraries:** plain Node 22 ES modules, no dependencies; tests with Vitest (`*.test.ts`).

**Owns:** the definition of "what loads" for NFR-PERF-1 (D9-05): an entry's static and dynamic relative imports, minus shared-singleton fallbacks (`__prebuild__` chunks, `localSharedImportMap`, dynamic imports made by `loadShare` chunks).

**Local commands:** `pnpm nx run ci-tools:test` · `pnpm nx run-many -t build -p shell tenants storage compute && pnpm size` · `pnpm check:no-test-hooks`.

**Local pitfalls**
- Both scripts read `apps/<app>/dist` (production). e2e builds are in `dist-e2e` (BUG-5) and are never measured.
- The closure depends on `@module-federation/vite`'s chunk names (`__prebuild__`, `loadShare`, `localSharedImportMap`). After upgrading it, re-check that `pnpm size` still excludes React and the ui-kit from the remotes (storage is about 70 kB; ~95 kB means fallbacks leaked in).
- Budgets are in SPEC.md NFR-PERF-1; change them there and in `.size-limit.mjs` together, never only here. Compute is close to its limit (about 109 of 110 kB on Day 9).
