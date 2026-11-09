# Day 1 prompt — Foundation

> Paste everything below the line into your coding agent (Claude Code, Cursor, Codex) from the repo root.
> Before you start: the repo must already contain the files from this starter kit (SPEC.md, AGENTS.md, .claude/, contracts/, docs/, specs/, prompts/, .nvmrc).

---

You're setting up the foundation of the Nimbus Console monorepo. This is milestone **Day 1** from `SPEC.md` §14.

## Read first
1. `AGENTS.md` (all of it). Follow its hard rules.
2. `docs/adr/ADR-0001-module-federation-with-vite.md`. Use **exactly** the tools and versions pinned there. Do not use Nx's Module Federation generators (`@nx/react:host`, `@nx/react:remote`); they're Webpack/Rspack-based and ADR-0001 rejects them.
3. `SPEC.md` §2 (architecture, repo layout, MF contract MF-1…MF-6, EventBus §2.5) and `docs/adr/ADR-0005-same-origin-gateway-and-cookie-session.md`.

Before writing any files, reply with: (a) your step-by-step plan, (b) any conflicts or gaps you see between these documents, and (c) anything in the pinned versions you're unsure about and how you'll verify it from the installed packages. Then wait for my "go".

## Scope — do this
0. **Spec split (first commit, TECH-1).** Split `SPEC.md` as laid out in SPEC.md §3.1: one file per feature spec in `specs/features/SPEC-<AREA>-<n>-<slug>.md` (front matter `id`, `title`, `area`, `day`, `implements`; AC table with a Status column), shared blocks and all rule IDs in `specs/shared/<topic>.md`. Feature specs link to shared files and never copy from them. SPEC.md keeps the overview, architecture summary, NFRs, testing strategy, build plan, demo script, Definition of Done and an index. Commit this on its own before anything else.
1. **Workspace.** Nx 24.0.2 + pnpm 12.16.1 workspace in the current directory without deleting existing files. `pnpm-workspace.yaml` includes `apps/*`, `libs/*`, `tools/*` and `contracts`, so there is **one root lockfile**; delete `contracts/node_modules` and install from the root. Root `package.json` with `"packageManager": "pnpm@12.16.1"`, `engines.node >=22`. `nx.json` with caching for `build`, `lint`, `typecheck`, `test`. Strict base `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes: false`, path aliases `@nimbus/*`). Prettier + ESLint 10 flat config with typescript-eslint.
2. **Libraries** (empty but buildable). **Every app and lib** gets a local `AGENTS.md` in the same PR (SPEC.md §11.1: at most 30 lines, fixed sections, never repeating root rules):
   - `libs/mf-contract` — `RemoteModule`, `RemoteContext` (including `path`), `SessionSnapshot`, root and scoped `EventBus` as in SPEC.md §2.4–§2.5. The types they import from `@nimbus/api-client/model` don't exist until Day 2: write minimal hand-made versions marked `// TODO(TECH-2): replace with @nimbus/api-client/model`. Implement `createRootBus()` with `scope()`, `dispose()` and `subscriberCount()`, with unit tests.
   - `libs/design-tokens` — `tokens.css` with the variables from SPEC.md §8.1.
   - `tools/mf/shared.ts` — the shared-singleton config from ADR-0001 R2, imported by every Vite config.
3. **Apps** (all Vite 8 + `@module-federation/vite` 1.23.7):
   - `apps/shell` — React 19 host on port 4200. Fetches the remote list from `/remotes.json` at runtime and validates it with Zod; a bad manifest shows an error, never a blank page (ADR-0001 R3, SPEC.md §2.2). Two manifests: `config/remotes.dev.json` (served by the shell's Vite dev server) and `config/remotes.gateway.json` (served by the gateway). The production CSP `script-src` is generated from the same file. Layout with a sidebar linking to `/tenants`, `/storage`, `/compute`. Each route mounts the matching remote through `RemoteModule.mount(el, ctx)`. A load failure or a throwing `mount()` shows "<Area> is temporarily unavailable." with a *Retry* button (SPEC-SHL-4, MF-6). The Vite dev server proxies `/api` (`ws: true`) to `http://localhost:4000`.
   - `apps/tenants` (4201) and `apps/storage` (4202) — React remotes exposing `./mount`. Each renders a heading ("Tenants", "Storage") and the `basePath` it received.
   - `apps/compute` (4203) — **Vue 3** remote exposing `./mount` with the same interface; renders a heading "Compute" using `<script setup lang="ts">`.
   - `apps/gateway` (8080) — Fastify + `@fastify/static` + `@fastify/http-proxy` (ADR-0005): serves the built shell at `/`, each built remote at `/remotes/<name>/`, and proxies `/api/*` (including the `/api/events` WebSocket upgrade) to mock-api. Resolve requests in the order given in SPEC.md §2.2: `/api/*` proxy → `/remotes/<name>/*` static files (missing file → 404, never a fallback) → real shell files → `index.html` with 200 for other `GET`/`HEAD` requests accepting `text/html` → 404. Reads the required `NIMBUS_MODE` (`dev` · `e2e` · `demo`; fail at start-up if missing or invalid; never read `NODE_ENV`). Supports `FAIL_REMOTES`, `TLS=1` (HTTPS on 8443) and, only when `NIMBUS_MODE` is `dev` or `e2e`, `POST /__test/fail-remotes` (`specs/mock-data.md` §8). Mock-api doesn't exist yet; the proxy target may be down today.
   - Every app: `build`, `serve`, `preview`, `lint`, `typecheck`, `test` targets. Builds support the three modes in SPEC.md §2.2 (`development`, `e2e`, `production`); `VITE_TEST_HOOKS` and test routes such as `/__crash` exist only in `development` and `e2e`.
4. **Root scripts:** `pnpm dev` (all four apps in parallel on fixed ports), `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e:stack` (build `--mode e2e`, start the gateway on 8080 with `NIMBUS_MODE=e2e`; mock-api from Day 2), `pnpm e2e`, `pnpm demo:local` (same stack with `MOCK_LATENCY_MS=150 MOCK_FAILURE_RATE=0.1`), `pnpm test:hooks` (`node --test '.claude/hooks/__tests__/*.test.mjs'`).
5. **E2E smoke.** `apps/e2e` with Playwright 1.64 (Chromium): one test file `smoke.spec.ts` that runs against the **gateway** at `http://localhost:8080` serving `e2e`-mode builds (not dev servers, not Vite preview ports):
   - `TECH-1: shell loads and shows navigation`
   - `TECH-1: each remote mounts from its /remotes/<name>/ path` (visit each route, assert its heading via `getByRole('heading')`)
   - `TECH-1: a failing remote shows the error panel and the rest of the shell still works` (intercept `**/remotes/storage/**` with `page.route` → 503)
6. **Git hooks.** `lefthook` with pre-commit running `nx affected -t lint typecheck test` on staged changes, plus `pnpm test:hooks` when `.claude/hooks/**` changes. The existing hook tests (`.claude/hooks/__tests__/`) must keep passing.
7. **CI.** `.github/workflows/ci.yml`: install with pnpm cache → `nx affected -t lint typecheck test build` → `ci/hooks` (`pnpm test:hooks`) → `ci/no-test-hooks` (build `production`, fail if `__crash` or `/__test/` appears in a bundle) → build `--mode e2e`, start the gateway on 8080 → Playwright smoke → upload Playwright report on failure. Use `nrwl/nx-set-shas` for affected base/head. Use the job IDs from SPEC.md §12.
8. **README.md** — how to install, `pnpm dev`, ports, and a link to SPEC.md and AGENTS.md.
9. **ADRs in this PR** (SPEC.md §13): ADR-0002 (framework-agnostic `mount(el, ctx)` contract) and ADR-0007 (test pyramid and zero retries).

## Out of scope today — don't build
Mock API, contract generation, auth/RBAC, real UI components, Storybook, size-limit, the MCP server. Leave TODO comments only where Day 2+ will plug in.

## Acceptance (I'll check all of these)
- `pnpm install && pnpm build` succeeds from a clean clone.
- `pnpm dev` → http://localhost:4200 shows the sidebar; Tenants, Storage (React) and Compute (Vue) each render inside the shell.
- In the browser Network tab, each remote's `remoteEntry.js` loads from its own port in dev and from `/remotes/<name>/` through the gateway, and `react`/`react-dom` load **once** (shared singleton).
- `pnpm e2e` passes all three smoke tests against the gateway on 8080.
- `specs/features/` exists and holds every AC from SPEC.md §7 exactly once.
- `pnpm nx affected -t lint typecheck test` passes. TypeScript strict with no `any`.
- No versions differ from ADR-0001. If you had to change one, explain why.

## If you get stuck
- If `@module-federation/vite` config differs from what you expect, read its README and types in `node_modules/@module-federation/vite` before trying alternatives. Don't switch tooling (AGENTS.md H11). Report the problem and what you tried.
- If the Vue remote can't share React-specific config, give it its own `shared` list (Vue only) as ADR-0001 R2 allows.

Finish with the summary format from AGENTS.md §6, plus a list of anything that surprised you about the tooling. I'll use it for the "where the agent failed" log.
