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
