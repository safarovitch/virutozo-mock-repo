# Nimbus Console

A mock multi-tenant cloud admin portal, built to show a spec-first, contract-first, agent-assisted frontend workflow: a React shell with React and Vue micro-frontends (Module Federation on Vite), a TypeSpec contract, and a harness that catches agent mistakes.

- **Spec:** [SPEC.md](SPEC.md), feature specs in [specs/features/](specs/features/), shared rules in [specs/shared/](specs/shared/)
- **Agent guide:** [AGENTS.md](AGENTS.md) (read it before changing anything)
- **Decisions:** [docs/adr/](docs/adr/) and [docs/decisions/](docs/decisions/)

## Install

```bash
nvm use                 # Node 22 (.nvmrc)
corepack enable         # pnpm 12.16.1 from package.json "packageManager"
pnpm install
```

## Run

| Command | What it does |
|---|---|
| `pnpm dev` | Shell (4200), the three remotes (4201–4203) and mock-api (4000) with hot reload. The shell proxies `/api` to mock-api. |
| `pnpm e2e:stack` | Builds everything in `e2e` mode and starts mock-api and the gateway on 8080: one origin for the app, the remotes and the API. |
| `pnpm contract:build && pnpm api:generate` | Rebuilds the contract and regenerates `libs/api-client` (CI fails on any drift). |
| `pnpm e2e` | Playwright against the gateway (starts `e2e:stack` if it isn't running). |
| `pnpm demo:local` | The live demo: the e2e stack with realistic latency and failures. |
| `pnpm build` · `pnpm lint` · `pnpm typecheck` · `pnpm test` | Every project, through Nx. |
| `pnpm test:hooks` | Tests for the Claude Code hooks in `.claude/hooks/`. |
| `pnpm trace` | AC → tests coverage (`trace:check`, rules T1–T6). |
| `pnpm size` | Bundle budgets (NFR-PERF-1) on the production build; run `pnpm build` first. |
| `pnpm eval <fixture> [--checks]` | Grades a skill eval fixture (`tools/evals`). |
| `pnpm storybook` | The component workshop (ui-kit on 6006). |

Demo users: sign in on `/login` by picking a role (provider admin, reseller admin, tenant admin, tenant viewer). Seed data is in [specs/mock-data.md](specs/mock-data.md).

If port 4000 or 8080 is busy (for example a running `pnpm dev`), stop it first: `pnpm e2e` and `pnpm demo:local` need both. If port 8080 is busy on your machine, copy `.env.example` to `.env` (it sets `GATEWAY_PORT=8090`) or run `GATEWAY_PORT=8090 pnpm e2e`. The gateway, Playwright's `baseURL` and mock-api's `APP_ORIGINS` all follow `GATEWAY_PORT`.

| Port | Service |
|---|---|
| 4200 | shell (dev) |
| 4201 · 4202 · 4203 | tenants · storage · compute (dev) |
| 4000 | mock-api |
| 8080 | gateway (e2e, demo, preview) |

## Architecture in one minute

- **Micro-frontends:** a React shell loads three remotes at runtime with Module Federation on Vite: tenants and storage (React), compute (**Vue 3**). Remotes share only React, TanStack Query, the design tokens and the ui-kit, and talk to the shell through a typed `mount()` contract and a scoped event bus ([ADR-0001](docs/adr/ADR-0001-module-federation-with-vite.md), [ADR-0002](docs/adr/ADR-0002-framework-agnostic-mount-contract.md)).
- **Contract first:** the API is defined in TypeSpec (`contracts/main.tsp`); Orval generates the React and Vue Query clients, Zod schemas and MSW handlers ([ADR-0003](docs/adr/ADR-0003-typespec-contract-and-orval-generation.md)). Generated code is never edited.
- **Server state:** each area owns its own query cache; one WebSocket in the shell feeds `server:*` events to every area's cache ([ADR-0004](docs/adr/ADR-0004-query-cache-as-server-state.md)).
- **Security:** one origin through a gateway, an httpOnly SameSite=Strict cookie session with a CSRF header ([ADR-0005](docs/adr/ADR-0005-same-origin-gateway-and-cookie-session.md)); the UI checks permissions, never roles, and the API is the boundary ([ADR-0006](docs/adr/ADR-0006-permission-based-ui-checks.md)).
- **Tests:** a pyramid with zero retries; every test title starts with the ID it proves ([ADR-0007](docs/adr/ADR-0007-test-pyramid-and-zero-retries.md)).

## The agent harness

| Part | Where | What it does |
|---|---|---|
| Agent guide | [AGENTS.md](AGENTS.md), plus a local `AGENTS.md` in every project | IDs first, contract first, 15 hard rules and how each is enforced, the end-of-task summary |
| Hooks | `.claude/hooks/` (+ `lefthook.yml`) | typecheck and lint after every edit; block generated files, the harness itself, weakened tests and destructive commands |
| Lint rules | `tools/eslint-rules/`, ledger in [docs/review-rules.md](docs/review-rules.md) | the hard rules as ESLint errors (raw `fetch`, role checks, permission strings, cross-remote imports, sockets, hand-written query keys, server text, test IDs, Playwright sleeps) |
| Skills | `.claude/skills/` | how to add a table page, a wizard, a contract change, an e2e journey, a bug fix, a long-running task |
| Subagents | `.claude/agents/` | spec-reviewer and code-reviewer (read-only), test-writer (tests from ACs only), bug-reproducer |
| MCP spec server | `tools/mcp-spec-server/`, registered in `.mcp.json` | `get_requirement`, `search_specs`, `get_operation`, `get_permissions`, `coverage_for` |
| Traceability | `tools/trace/`, `pnpm trace` | every AC `done` has a test titled with its ID; PRs list what they implement |
| Evals | `tools/evals/`, results in `tools/evals/results/` | score a skill against fixed tasks; a skill change must not lower a score |
| Budgets | `.size-limit.mjs`, `pnpm size` | gzip budgets for the shell, each remote and the ui-kit |

## Where the agent failed and what I changed

Every agent mistake is logged in [docs/agent-log.md](docs/agent-log.md). The most useful so far:

1. **A hook that blocked the wrong things, and missed real ones.** `guard-bash` matched the whole command text, so it blocked a harmless log update that only *mentioned* `rm -rf` in a heredoc. Writing tests for the fix found two real holes: `rm -rf dist/../apps` slipped through, and `contracts/node_modules` was wrongly blocked. → The hook now checks only the parts of a command that execute, and ships with 30+ tests. New rule: every hook ships with tests.
2. **A hook that failed open.** The fixed hook had an entry-point check that silently skipped all blocking when run through a symlinked path; unit tests passed because they imported the logic directly. → Logic moved to a library, the entry file always runs the check, and process-level tests run the real hook, including through a symlink.
3. **The harness could switch itself off.** Nothing stopped an agent from editing `.claude/settings.json` or the hooks. → `guard-paths` now protects the harness unless a human creates `.claude/allow-harness-change`.
4. **Stale files that shadowed the generated client for a week.** An early `tsc` run left 64 `.js` files next to the generated `.ts` models, and they were committed. Bundlers prefer `.js`, so every contract change to a constant since then silently didn't reach the apps; it surfaced only when a new permission (`vitals:read`) made a provider see a 403 page in e2e. → The files are gone, a `BUG-6` test fails if any `.js` appears in `generated/`, and the contract-change skill says to check.
5. **A coverage tool that hid tests.** The trace scanner read a regex literal with an apostrophe (`/can't/`) as the start of a string, so the test titles after it vanished and a `done` AC looked untested. → `BUG-4`: the scanner understands regex literals, with a test for the exact case.
6. **Versions and runtimes from memory.** The agent wrote an Nx plugin path that no longer exists in Nx 24 and pinned a React backport release; later it built the lint plugin in TypeScript for Node 22's type stripping, but the post-edit hook runs ESLint with the machine's default Node 20 and crashed on every edit. → AGENTS.md: "check versions, not memory"; tools the harness loads are plain `.mjs` and are smoke-tested on Node 20.
7. **A proxy that silently dropped a security header.** The gateway's WebSocket proxy forwarded the cookie but not `Origin`, so the API (correctly) rejected every proxied socket. Unit tests on both sides passed; only an end-to-end check through the gateway showed it. → The gateway forwards `Origin`, and a test now proxies a real socket and checks the headers.
8. **Tests that raced the app instead of testing it.** E2E checks passed "no Tenants link" before a second tab had finished booting, so a sign-out in the first tab raced its `/me` call; a Playwright check read a beacon body that Playwright only exposes when the request is intercepted. → Wait for a ready signal before acting in another tab; the e2e guide and the `write-e2e` skill now say both.

## Repository layout

See [SPEC.md §2.3](SPEC.md). Apps in `apps/` (shell, tenants, storage, compute, mock-api, gateway, e2e), libraries in `libs/`, the contract in `contracts/`, tools in `tools/` (lint rules, trace, evals, MCP server, CI scripts), the harness in `.claude/` (hooks, skills, agents).
