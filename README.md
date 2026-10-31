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

If port 8080 is busy on your machine, copy `.env.example` to `.env` (it sets `GATEWAY_PORT=8090`) or run `GATEWAY_PORT=8090 pnpm e2e`. The gateway, Playwright's `baseURL` and mock-api's `APP_ORIGINS` all follow `GATEWAY_PORT`.

| Port | Service |
|---|---|
| 4200 | shell (dev) |
| 4201 · 4202 · 4203 | tenants · storage · compute (dev) |
| 4000 | mock-api |
| 8080 | gateway (e2e, demo, preview) |

## Where the agent failed and what I changed

Every agent mistake is logged in [docs/agent-log.md](docs/agent-log.md). The most useful so far:

1. **A hook that blocked the wrong things, and missed real ones.** `guard-bash` matched the whole command text, so it blocked a harmless log update that only *mentioned* `rm -rf` in a heredoc. Writing tests for the fix found two real holes: `rm -rf dist/../apps` slipped through, and `contracts/node_modules` was wrongly blocked. → The hook now checks only the parts of a command that execute, and ships with 30+ tests. New rule: every hook ships with tests.
2. **A hook that failed open.** The fixed hook had an entry-point check that silently skipped all blocking when run through a symlinked path; unit tests passed because they imported the logic directly. → Logic moved to a library, the entry file always runs the check, and process-level tests run the real hook, including through a symlink.
3. **The harness could switch itself off.** Nothing stopped an agent from editing `.claude/settings.json` or the hooks. → `guard-paths` now protects the harness unless a human creates `.claude/allow-harness-change`.
4. **Claims without reading the source.** The agent reported that a hook blocks a command without reading the hook, and changed an ADR reference while claiming it was its own finding. Both were caught in review. → Reviews now check claims against files; the review process stops on facts, not memory.
5. **Versions from memory.** The agent wrote an Nx plugin path that no longer exists in Nx 24, used a `tsconfig` option TypeScript 6 deprecates, and pinned a React backport release. The post-edit hook (typecheck + lint on every edit) caught the first two within seconds. → AGENTS.md: "check versions, not memory"; candidate CI step: `pnpm peers check`.
6. **A broken root URL that only an end-to-end test could see.** The gateway returned 403 for `/`; unit tests didn't cover it, the Playwright smoke test did. → Gateway test added for `/`.
7. **A proxy that silently dropped a security header.** The gateway's WebSocket proxy forwarded the cookie but not `Origin`, so the API (correctly) rejected every proxied socket. Unit tests on both sides passed; only an end-to-end check through the gateway showed it. → The gateway forwards `Origin`, and a test now proxies a real socket and checks the headers.

## Repository layout

See [SPEC.md §2.3](SPEC.md). Apps in `apps/` (shell, tenants, storage, compute, gateway, e2e), libraries in `libs/`, the contract in `contracts/`, harness hooks in `.claude/hooks/`.
