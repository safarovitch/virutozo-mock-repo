# ADR-0001 — Micro-frontends with Module Federation on Vite

- **Status:** Accepted
- **Date:** 2026-10-30
- **Deciders:** Rasul Idiev
- **Related:** SPEC.md §2, MF-1…MF-4, NFR-PERF-1

## Context

Nimbus Console is a shell plus three independently built areas (Tenants, Storage in React; Compute in Vue). We need:

1. Independent build and deploy per area.
2. Runtime composition in one page, with shared singletons (React, TanStack Query, design tokens).
3. A React shell that can host a Vue remote (mirrors migrating a large Vue app, V/IS, toward micro-frontends).
4. Vite as the build tool, because that's the target team's stack and it gives fast dev feedback.
5. An Nx monorepo for task orchestration, affected builds and caching.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **A. Vite + `@module-federation/vite`** (Module Federation 2.0 runtime) | Matches target stack (Vite + MF); same MF 2.0 runtime as Webpack/Rspack; supports shared singletons, type hints (dts plugin) and runtime remotes | Nx's MF generators don't target Vite, so host/remote config is written by hand; smaller community than Webpack MF |
| B. Nx built-in MF (`@nx/react:host`/`remote`) on Rspack/Webpack | One command scaffolds host + remotes; most documented path in Nx | Not Vite, so it doesn't match the target stack; Vue remote needs extra manual work anyway |
| C. Iframes | Strong isolation, any framework | Poor UX (focus, scrolling, modals, routing), duplicate downloads, hard to share session |
| D. Build-time packages (each area an npm lib) | Simplest tooling | No independent deploys, so not really micro-frontends |

## Decision

**Option A.** Use Vite with `@module-federation/vite` for the shell and all remotes, inside an Nx workspace using `@nx/vite` for build, serve, preview and test targets.

### Rules that follow from this decision
- **R1** Each remote exposes exactly one module, `./mount`, implementing `RemoteModule` from `libs/mf-contract` (see ADR-0002). React and Vue remotes look identical to the shell.
- **R2** Shared singletons are declared once in `tools/mf/shared.ts` and imported by every `vite.config.ts`: `react`, `react-dom`, `@tanstack/react-query` (React remotes only), `@nimbus/design-tokens`, `@nimbus/ui-kit` (React apps only: shell, tenants, storage). Vue and `@tanstack/vue-query` are **not** shared with the shell; the compute remote bundles them (they're inside its size budget).
- **R3** Remote URLs come from a runtime manifest fetched at `/remotes.json` and validated with Zod, not hard-coded in the build, so environments can change URLs without rebuilding the shell. There are two manifests: `config/remotes.dev.json` (dev-server URLs, served by the shell's Vite dev server) and `config/remotes.gateway.json` (paths such as `/remotes/tenants/remoteEntry.js`, served by the gateway, ADR-0005). The CSP `script-src` is generated from the same file (NFR-SEC-1).
- **R4** Fixed dev ports: shell 4200, tenants 4201, storage 4202, compute 4203, mock-api 4000, gateway 8080 (ADR-0005).
- **R5** Each remote's `remoteEntry.js` and chunks are checked by `size-limit` (NFR-PERF-1).
- **R6** Do not switch to Webpack/Rspack or Nx's MF generators without a new ADR that supersedes this one.

### Pinned versions (2026-10-30)

Checked for peer compatibility on that date. Upgrades require a PR that runs the full CI.

| Tool | Version | Note |
|---|---|---|
| Node.js | 22 LTS (`.nvmrc`) | |
| pnpm | 12.16.1 (`packageManager` field) | |
| Nx | 24.0.2 (`nx`, `@nx/vite`, `@nx/vitest`, `@nx/react`, `@nx/vue`, `@nx/js`, `@nx/eslint`, `@nx/playwright`, `@nx/storybook`) | all `@nx/*` must match exactly |
| Vite | 8.3.x | |
| `@module-federation/vite` | 1.23.7 | peer `vite ^5–^8` |
| `@vitejs/plugin-react` | 6.1.x | requires Vite 8 |
| `@vitejs/plugin-vue` | 6.0.x | |
| TypeScript | **6.0.3** | not 7.x: `typescript-eslint` 8.72 supports `<6.1` |
| React / React DOM | 19.x | |
| Vue | 3.5.x, `vue-tsc` 3.3.x | |
| `@tanstack/react-query` / `@tanstack/vue-query` | 5.105.0 | |
| `@tanstack/react-table` | 9.x | v9 API differs from v8; read installed docs |
| `@tanstack/react-virtual` | 3.x | |
| React Router | 8.x | |
| Orval | 8.45.0 | verified against `contracts/openapi.yaml` |
| Zod | 4.x | |
| MSW | 3.x | |
| Vitest | 5.0.x | |
| Storybook | 10.6.x (`@storybook/react-vite`, `@storybook/vue3-vite`) | |
| Playwright | 1.64.x | |
| Fastify / `@fastify/websocket` | 5.12.x / 11.3.x | |
| TypeSpec | 1.17.0 | |
| ESLint / typescript-eslint | 10.x / 8.72.x | flat config |

## Consequences

- **Positive:** stack matches the target team; remotes deploy independently; Vue and React coexist through one mount contract; Nx still gives affected builds and caching.
- **Negative:** host and remote Vite configs are hand-written and must be kept consistent (mitigated by `tools/mf/shared.ts` and an e2e test that loads every remote). Some Nx MF conveniences (`nx serve shell --devRemotes`) aren't available; a root `pnpm dev` script starts everything in parallel instead.
- **Risk:** several pinned majors (Vite 8, React Router 8, TanStack Table 9, Vitest 5, MSW 3) are newer than many coding agents' training data. Agents must read the installed package's docs and types instead of relying on memory. This rule is in `AGENTS.md`.
