# Day 1 spec check — Decisions (partial)

- **Status:** Accepted · **Date:** 2026-10-31 · **Owner:** Rasul Idiev
- **Input:** `docs/reviews/2026-10-31-day-1-spec-check.md`
- **Decided here:** all Day 1 findings, D1-01 to D1-18. Part 1 (below) was decided first; part 2 closes the rest and adds the "What blocks building" rule.

| ID | Decision | Applied in |
|---|---|---|
| D1-08 | `guard-bash` checks only the parts of a command that run. Heredoc bodies and quoted strings are data; `bash -c` / `sh -c` / `eval` arguments, `$(…)` and backticks inside double quotes, and heredocs fed to a shell are checked. Any `rm -rf` path containing `..` is blocked; `contracts/node_modules` is allowed. Fixed by Rasul with 30 tests. | `.claude/hooks/guard-bash.mjs`, `.claude/hooks/__tests__/guard-bash.test.mjs`, `docs/agent-log.md` |
| D1-09 | Hook tests live in `.claude/hooks/__tests__/*.test.mjs` and run with Node's built-in runner (`node --test '.claude/hooks/__tests__/*.test.mjs'`, root script `pnpm test:hooks`), so they work before `pnpm install`. Lefthook runs them in pre-commit when `.claude/hooks/**` changes; CI runs them as `ci/hooks`, a valid `verify:` target. Every hook ships with tests. | SPEC.md §11.4, §12; `specs/tech-tasks.md` TECH-5, TECH-7; AGENTS.md §4–§5; Day 1 prompt; new tests for `guard-paths` (12) and `guard-tests` (13) |
| D1-02 | Two remote manifests, both fetched by the shell at `/remotes.json` and validated with Zod (a bad manifest shows an error, never a blank page): `config/remotes.dev.json` (dev-server URLs, served by the shell's Vite dev server) and `config/remotes.gateway.json` (paths, served by the gateway for e2e, `demo:local` and the preview). The CSP `script-src` is generated from the same file. | SPEC.md §2.2, §2.3, NFR-SEC-1; ADR-0001 R3; `specs/mock-data.md` gateway order; Day 1 prompt |
| D1-03 | Spec split: `specs/features/SPEC-<AREA>-<n>-<slug>.md` (front matter `id`, `title`, `area`, `day`, `implements`; AC table with a Status column); shared blocks in `specs/shared/<topic>.md` (`url-conventions`, `rbac`, `realtime`, `messages-and-format`, `mf-contract`); feature specs link, never copy; rule IDs live only in shared files; `trace:check` scans `specs/features/` and `specs/shared/`; SPEC.md keeps overview, architecture summary, NFRs, testing strategy, build plan, demo script, DoD and an index. | SPEC.md §2.3, §3.1, §3.2; `specs/tech-tasks.md` TECH-1; Day 1 prompt step 0 |
| D1-12 | Each ADR is written on the day its decision is first implemented, in the same PR: Day 1 ADR-0002, ADR-0007 · Day 2 ADR-0003 · Day 3 ADR-0006 · Day 4 ADR-0004. ADR-0001 and ADR-0005 exist. | SPEC.md §13, §14 Day 9; `specs/tech-tasks.md` TECH-1/2/4/5; Day 1 and Day 2 prompts |
| D1-14 | Every app and lib gets a local `AGENTS.md`, at most 30 lines, with fixed sections (purpose · framework and key libraries · what it owns · local commands · local pitfalls), never repeating root rules, created in the same PR as the project and updated when a pitfall reaches `docs/agent-log.md`. | SPEC.md §11.1; AGENTS.md §1.3; `specs/tech-tasks.md` TECH-1; Day 1 prompt |

## Part 2 — the remaining 11 items and the rule that stops the loop

| ID | Decision | Applied in |
|---|---|---|
| D1-16 | `guard-bash` logic moves to `guard-bash.lib.mjs`; `guard-bash.mjs` always runs the check (no entry-point guard). Process-level tests run the real hook, including through a symlinked folder. Same pattern for any hook that exports functions. | `.claude/hooks/guard-bash.lib.mjs`, `guard-bash.mjs`, `__tests__/guard-bash.test.mjs` |
| D1-15 | `guard-tests` strips string literals and comments before looking for skip patterns. Tests added. | `.claude/hooks/guard-tests.lib.mjs`, `guard-tests.mjs`, `__tests__/guard-tests.test.mjs` |
| D1-17 | The 30 `guard-bash` tests carry the `TECH-7:` prefix. | `__tests__/guard-bash.test.mjs` |
| D1-18 | Any newly added `toMatchSnapshot` / `toMatchInlineSnapshot` is blocked unless `.claude/allow-test-change` exists. Tests added. | `guard-tests.lib.mjs`, tests |
| D1-01 | Day 1: `libs/mf-contract` uses minimal hand-made types marked `// TODO(TECH-2): replace with @nimbus/api-client/model`; Day 2 swaps them for the generated types (F11). | SPEC.md §2.4, `specs/tech-tasks.md` TECH-2, Day 1 and Day 2 prompts |
| D1-04 | TECH-5 moves to the earliest day it can be done; the agent chose **Day 5** (`ci/perf` needs the tenant list). Jobs owned by other TECH items are added by them. | `specs/tech-tasks.md` TECH-5, SPEC.md §14 Days 1 and 5 |
| D1-05 | The Day 1 prompt wins: pre-commit runs `nx affected -t lint typecheck test`, plus `pnpm test:hooks` when `.claude/hooks/**` changed. HOOK-4 updated. | SPEC.md §11.4 |
| D1-06 | The shipped hooks are the truth; the §11.4 table now describes them. HOOK-6 (never shipped) is retired. | SPEC.md §11.4, `specs/retired-ids.md` |
| D1-07 | H12's text matches the hook's allowlist and points to it. | AGENTS.md H12 |
| D1-10 | `guard-paths` blocks agent edits to `.claude/settings.json` and `.claude/hooks/**` unless `.claude/allow-harness-change` exists; only the human creates it. Tests added. New rule H15. | `.claude/hooks/guard-paths.mjs`, `__tests__/guard-paths.test.mjs`, AGENTS.md H15, `.gitignore` |
| D1-11 | `@nimbus/ui-kit` is a shared singleton for the React apps (shell, tenants, storage). Closes R6. | SPEC.md MF-2, ADR-0001 R2 |
| D1-13 | No nested lockfiles: `contracts/` is a pnpm workspace package from Day 1, with one root lockfile. | SPEC.md §14 Day 1, Day 1 and Day 2 prompts |
| Rule | **What blocks building:** stop and ask only for product behaviour users would notice, security, or anything irreversible. Decide everything else, keep building, and record it here for batch review. | AGENTS.md §1a |

Hook tests after these changes: 71 passing (`pnpm test:hooks`).

## Part 3 — decisions the agent made while building Day 1

(Recorded under the "What blocks building" rule, for review at the end of the day.)

| ID | Decision (agent) | Why |
|---|---|---|
| A1-01 | Rule IDs that D1-03 doesn't assign to a shared topic (NFR, TEST, HOOK, API, T1–T6) stay defined in SPEC.md, together with the sections D1-03 doesn't list (traceability, requirements, API index, design system, harness, CI, ADRs). | D1-03 lists five shared topics and says SPEC.md keeps NFRs and the testing strategy; moving the rest would invent new topics. `trace:check` already scans SPEC.md (E14). |
| A1-02 | Moved SPEC.md sections (§2.4, §2.5, §5, §6.3, §9 Messages & formatting) keep a one-line stub under their old heading that links to the shared file. Inside feature and shared files, § references to moved sections became links; others became "SPEC.md §n". | Dozens of existing references ("SPEC.md §2.5") keep working without rewriting every file. |
| A1-03 | Every feature file carries a "Shared rules:" line linking all five shared files, and its front matter adds no fields beyond D1-03's (`id`, `title`, `area`, `day`, `implements`); scope (MVP/Stretch) stays in the heading. Stretch specs (PLN-1, CMP-3) get files and `day: stretch`. | Keeps front matter as decided; one place to find shared rules. |
| A1-04 | eslint **10.13.0** instead of 10.14.0. | 10.14.0 was published the day before; pnpm 12 wanted a `minimumReleaseAgeExclude` exception. Keeping the release-age safeguard intact; still ESLint 10.x as ADR-0001 pins. |
| A1-05 | **Allowed install scripts for `nx` and `lefthook` only** (`allowBuilds` in `pnpm-workspace.yaml`). | Both need their postinstall (Nx native binary, lefthook binary). Security-relevant, so flagged for review. |
| A1-06 | React and React DOM **19.3.1** (latest 19.x) instead of 19.1.10. | React Router 8 needs ≥ 19.2.7; 19.1.10 is the `backport` tag (agent mistake, see agent log). ADR-0001 pins "19.x". |
| A1-07 | Unpinned-in-ADR dependencies: `@fastify/static` 10.1.8, `@fastify/http-proxy` 11.6.5, `@module-federation/runtime` 2.9.2 (same as the plugin's), `eslint-plugin-vue` ^10, `globals` 17.13.0, `@types/node` ^22. | Latest versions compatible with the pinned ones; no peer issues (`pnpm peers check`). |
| A1-08 | Nx targets: `@nx/vite` infers build/serve/preview, `@nx/vitest` infers test (ADR-0001); typecheck, lint and build-e2e are `package.json` scripts. Every package sets `nx.name` to its folder name. | Follows ADR-0001 while keeping typecheck explicit (`tsc` / `vue-tsc`). HOOK-1 and root scripts address projects by folder name. |
| A1-09 | `tools/mf/shared.ts` shares `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client`, `@nimbus/design-tokens`; `@tanstack/react-query` and `@nimbus/ui-kit` are listed as TODOs until they're installed (TECH-2/4, TECH-6). | Sharing a package that doesn't exist breaks the build; subpath keys keep the React singletons for `jsx-runtime` and `createRoot` (verified by smoke test 2). |
| A1-10 | `dts: false` in every federation config. | Remote types come from `libs/mf-contract`; MF type generation isn't needed and slows builds. |
| A1-11 | Shell federation uses `hostInitInjectLocation: 'entry'`. | Avoids an inline init script, so the production CSP stays `script-src 'self'` (verified: gateway sends that CSP and the app loads). |
| A1-12 | `createRootBus({ strict, onError })`; the shell passes `strict = mode !== 'production'` and the default `onError` logs to the console until `libs/logger` exists (TECH-14, Day 2). | Keeps `libs/mf-contract` framework- and logger-free. |
| A1-13 | Day 1 shell placeholders: anonymous `SessionSnapshot` (`TODO(SPEC-SHL-1)`), `/` redirects to `/tenants`, UI strings inline (`TODO(TECH-14)`). | Sign-in, home area and message catalogues are later days. |
| A1-14 | The shell's manifest fetch (`apps/shell/src/manifest.ts`) is the one direct `fetch()` in app code. | `/remotes.json` is static config, not an API operation, so there's no generated client. `nimbus/no-direct-fetch` (TECH-10) must allowlist this file. |
| A1-15 | The gateway is plain ESM JavaScript with JSDoc, type-checked by `tsc --checkJs`; its test file is excluded from `checkJs`. | Runs with `node` directly (no build step); strict checks stay on production code. |
| A1-16 | Gateway `TLS=1` needs `TLS_CERT` and `TLS_KEY` paths. | The nightly HTTPS suite (E8) generates a self-signed cert in CI; the gateway doesn't create certificates itself. |
| A1-17 | The gateway's shell static handler uses `index: 'index.html'`. | `GET /` returned 403 otherwise (caught by the smoke test). |
| A1-18 | The gateway and Playwright read `PORT` (default 8080). | An Apache server occupies 8080 on this machine; Day 1 was verified on 8090. CI uses 8080. |
| A1-19 | `libs/design-tokens` has no build target; `libs/mf-contract` builds declarations with `tsc`. | Tokens are a CSS file consumed by Vite as source. |
| A1-20 | No `eslint-plugin-react-hooks` yet. | Not in ADR-0001's pins; the effects in `RemoteHost.tsx` are commented instead. Candidate for Day 3. |
| A1-21 | **AC-SHL-1.14 set to `done`** (gateway unit test), and listed in a commit's `Implements:`. | Implemented and tested on Day 1 although SPEC-SHL-1 is scheduled for Day 3. |
| A1-22 | Smoke tests go a little beyond the prompt: test 2 asserts the React remotes never fetch their own React chunks; test 3 also checks *Retry* recovers without a page reload. | They prove two acceptance items (shared singletons, Retry) that would otherwise be checked by hand. |
| A1-23 | TECH-1 and TECH-7 set to `done`; TECH-5 to `in-progress` (done Day 5, D1-04). | Day 1 acceptance list passed; TECH-7 has `TECH-7:` tests and `ci/hooks`. |
| A1-24 | Re-checked Day 1 acceptance on a branch that already holds Day 2: install, build, lint, typecheck, test, `test:hooks` (71), `check:no-test-hooks`, 122 ACs once each, all local `AGENTS.md` files and the 3 smoke tests pass (smoke on `PORT=8090`, see A1-18). No Day 1 scope is missing. | The prompt asked to continue Day 1; nothing was left except the launcher bug in A1-25. |
| A1-25 | **Harness fix:** `tools/run-stack.mjs` starts mock-api with `node --import tsx` (not `pnpm start`) and exits non-zero when a child fails. Not a test: the launcher has no test target, and Playwright's own "webServer was not able to start" now covers the failure. | A busy port hung `pnpm e2e` instead of failing (agent log). Obvious fix, no product behaviour. |
