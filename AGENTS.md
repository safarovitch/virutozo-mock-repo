# Nimbus Console — Agent guide

You are working in an Nx + pnpm monorepo: a React shell with micro-frontends (React and Vue) built with Vite and Module Federation, on top of a contract-first mock API. Read this whole file before your first change.

## 1. Before you change anything

1. **Find the IDs.** Every feature task maps to `SPEC-*` / `AC-*` IDs in `specs/features/` (or `SPEC.md` §7 until it's split). Engineering work maps to `TECH-*` IDs (`SPEC.md` §14.1) or existing `NFR-*` / `ADR-*` IDs. If the task has no ID, **stop and ask for one**. Don't invent requirements.
2. **Read the contract.** Check the operations you'll use in `contracts/openapi.yaml`, including `x-permission` and the error codes. Seed data and error messages are in `specs/mock-data.md`.
3. **Read the local guide.** Each app and lib has its own `AGENTS.md` (at most 30 lines: purpose · framework and key libraries · what it owns · local commands · local pitfalls). It never repeats root rules; it only adds to or narrows them for that folder. Create it in the same PR as the project, and update it whenever a pitfall reaches `docs/agent-log.md`.
4. **Check versions, not memory.** Several dependencies are newer than your training data (Vite 8, React Router 8, TanStack Table 9, Vitest 5, MSW 3, Storybook 10, TypeScript 6). Before using an API, read the installed types in `node_modules/<pkg>` or its docs. Versions are pinned in `docs/adr/ADR-0001-module-federation-with-vite.md`. Never upgrade, downgrade or add a dependency without saying so in your summary.

### 1a. Before starting a day's milestone
1. Run the `spec-reviewer` pass on **only** the specs scheduled for that day (SPEC.md §14), plus deferred review items for those areas (`docs/decisions/`, "Still deferred").
2. Report findings with IDs and save the output as `docs/reviews/<date>-<scope>.md`. Classify each as **product decision** (the human decides), **contradiction** (the human picks which side wins), or **missing detail** (you may propose wording).
3. **Stop and wait.** Don't resolve product decisions or contradictions yourself.
4. Apply the human's decisions, record them in a dated `docs/decisions/` file, then start building.

## 2. Hard rules

These are enforced by hooks, lint rules or CI. Breaking one means your change will be rejected.

| # | Rule | Enforced by |
|---|---|---|
| H1 | Never edit `contracts/openapi.yaml` or `libs/api-client/src/generated/**`. Change `contracts/main.tsp`, then run `pnpm contract:build && pnpm api:generate`. | hook `guard-paths`, CI `contract:check` |
| H2 | Never call `fetch`/`axios` directly in app code. Use generated hooks and clients from `@nimbus/api-client`. | lint `nimbus/no-direct-fetch` |
| H3 | Never check role names. Use `can()`, `<Can>` or `v-can` with values from the generated `Permission` enum. | lint `nimbus/no-role-check`, `nimbus/no-raw-permission` |
| H4 | Never weaken, delete or skip an existing assertion to make a test pass. If you think a test is wrong, stop and explain why. | hook `guard-tests`, review |
| H5 | Every acceptance criterion you implement gets at least one test whose title starts with the AC ID, e.g. `it('AC-TEN-2.4: …')`, and you set its status (`in-progress`/`done`) in the spec in the same PR. Every test title starts with a known, non-retired ID. Allowed prefixes: `AC TECH BUG NFR MF RT WS RBAC API TEST MSG HOOK E2E ADR` (list in `tools/trace/ids.ts`; retired IDs in `specs/retired-ids.md`). | CI `trace:check` (SPEC.md §3.3, T1–T6), lint `nimbus/test-name-has-id` |
| H6 | Every UI that loads data handles **loading, empty, error and no-permission** states, each with a Storybook story. | review, `code-reviewer` subagent |
| H7 | Remotes never import from other remotes. They talk to the shell only through `@nimbus/mf-contract`. | lint `nimbus/no-cross-remote-import` |
| H8 | No `dangerouslySetInnerHTML`, no `v-html`, no session data in `localStorage`/`sessionStorage`/IndexedDB. The session is an httpOnly, Secure, SameSite=Strict cookie on the same origin (ADR-0005); never read or copy it, and never add CORS. Mutating requests go through `customFetch`, which adds `X-Nimbus-Csrf`. | lint, review |
| H9 | No `any` without a `// reason:` comment. No `@ts-ignore`; use `@ts-expect-error` with a reason. | lint |
| H10 | Playwright: no `waitForTimeout`, no CSS-class selectors. Use `getByRole` and web-first assertions. | lint `nimbus/no-playwright-sleep` |
| H11 | Don't change Module Federation tooling (Vite + `@module-federation/vite`), ports or shared singletons without an ADR. | review |
| H12 | Don't run destructive commands: `rm -rf` outside `dist/`/`tmp/`, `git push --force`, `git reset --hard`. | hook `guard-bash` |
| H13 | Only `libs/realtime` opens a WebSocket. Remotes get server events from their bus scope (`server:*`). Each area has its own `QueryClient` and never touches another area's cache; query keys come only from Orval's generated helpers (SPEC.md §2.5, RT-1…12). | lint `nimbus/no-websocket-outside-realtime`, `nimbus/no-handwritten-query-key`, review |
| H14 | Never render server text (`problem.title`, `problem.detail`). Show the message for `Problem.code` from the typed catalogues; no inline UI strings (SPEC.md §9, MSG-1…4). | lint `nimbus/no-server-text` |

## 3. How to work

1. Restate the IDs you're implementing and any gaps or ambiguities you see in the spec **before** coding. If something is ambiguous, ask; don't guess.
2. Change the contract first if needed (H1), then regenerate.
3. Move the ACs you're implementing from `planned` to `in-progress`. Write or update tests from the acceptance criteria. Prefer writing the test first.
4. Implement the smallest change that passes them.
5. Run the checks in §4. Fix everything they report. Set each AC that now has a passing test to `done`.
6. Finish with the summary in §6.

Keep changes focused on the task. Don't refactor unrelated code; note it in your summary instead.

## 4. Commands

```bash
pnpm dev                                   # mock-api + shell + all remotes (ports below)
pnpm nx affected -t lint typecheck test    # fast checks for your change
pnpm nx run <project>:test                 # one project's unit/component tests
pnpm e2e:stack                             # build --mode e2e, start mock-api (4000) + gateway (8080) with NIMBUS_MODE=e2e
pnpm e2e                                   # Playwright against :8080 (starts e2e:stack via webServer if not running)
pnpm e2e --grep "AC-TEN-2"                 # e2e tests for specific ACs
pnpm demo:local                            # live interview demo: e2e build, NIMBUS_MODE=e2e MOCK_LATENCY_MS=150 MOCK_FAILURE_RATE=0.1
pnpm storybook                             # component workshop
pnpm contract:build && pnpm api:generate   # after editing contracts/main.tsp (from Day 2: pnpm nx run contracts:contract-build)
pnpm trace                                 # AC → tests coverage report
pnpm test:hooks                            # tests for .claude/hooks (node --test; needs Node ≥ 21)
pnpm size                                  # bundle budgets
```

Before Day 2, build the contract on its own with Node 22 and pnpm (never npm):

```bash
nvm use                      # Node 22 from .nvmrc
cd contracts
pnpm install && pnpm build && pnpm lint   # lint must report 0 errors and 0 warnings
```

Ports: shell 4200 · tenants 4201 · storage 4202 · compute 4203 · mock-api 4000 · gateway 8080 (e2e, preview, demo) · Storybook 6006.

## 5. Where things live

| Path | What |
|---|---|
| `SPEC.md` | Product + engineering spec (requirements, RBAC, NFRs, testing, harness) |
| `specs/features/SPEC-*.md` | One feature spec per file with ACs |
| `specs/tech-tasks.md` | `TECH-*` items, statuses and `verify:` jobs |
| `specs/retired-ids.md` | Withdrawn IDs and their replacements (never reuse them) |
| `specs/mock-data.md` | Seed data, demo users, plan limits, test endpoints, error code and UI message tables |
| `contracts/main.tsp` | API contract source of truth |
| `docs/adr/` | Architecture decisions. Read before changing architecture. Each ADR is written in the PR that first implements it (SPEC.md §13) |
| `docs/decisions/`, `docs/reviews/`, `docs/agent-log.md` | Dated decision records · dated spec-review outputs · one entry per agent incident |
| `specs/shared/` | Shared spec blocks and rule IDs (after the Day 1 split) |
| `config/remotes.*.json` | Remote manifests for dev and the gateway |
| `.claude/hooks/__tests__/` | Hook tests; every hook ships with tests |
| `apps/shell` | React host: auth, layout, nav, task center, error boundaries |
| `apps/tenants`, `apps/storage` | React remotes |
| `apps/compute` | **Vue 3** remote (`<script setup lang="ts">`, Composition API, Pinia) |
| `apps/mock-api` | Fastify + WebSocket mock backend, served under `/api` |
| `apps/gateway` | Same-origin gateway on 8080: shell, `/remotes/<name>/`, proxies `/api` (ADR-0005) |
| `apps/e2e` | Playwright tests |
| `libs/api-client` | Generated clients (React Query, Vue Query), Zod schemas, MSW handlers, `customFetch`, `configureApiClient({ onUnauthorized })`; `@nimbus/api-client/model` = types and enum constants only (the only entry `libs/mf-contract` may use, with `import type`) |
| `libs/auth` | Session + `can()` (framework-agnostic), `<Can>`, `v-can` |
| `libs/ui-kit`, `libs/ui-kit-vue`, `libs/design-tokens` | Design system |
| `libs/mf-contract` | `RemoteModule`, `RemoteContext`, root and scoped `EventBus` + event catalogue (SPEC.md §2.4, §2.5) |
| `libs/realtime` | The only WebSocket client: Zod validation, reconnect and close codes, publishes `server:*` / `realtime:*` on the bus, `mergeTask` |
| `libs/logger`, `libs/messages`, `libs/format` | Logger, typed message catalogue, formatters (SPEC.md §9) |
| `tools/` | ESLint rules, MCP spec server, evals, MF shared config |

## 6. Finish every task with this summary

```
Implements: SPEC-…, AC-…, TECH-…   (at least one known ID, T1)
AC status changes: AC-… planned → done, …
Tests added/changed: <file>: <test titles>
Checks run: lint ✅ typecheck ✅ test ✅ e2e ✅/not run (why)
Contract changes: none | <what + regenerated>
Dependencies changed: none | <what + why>
Open questions / spec gaps: …
Things I noticed but didn't change: …
```
