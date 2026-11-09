# tools/evals — local guide

**Purpose:** skill evals (SPEC.md §11.6, TECH-9) and the harness checks for skills and subagents (TECH-12, TECH-13). A skill or AGENTS.md change must not lower a fixture's score.

**Framework and key libraries:** plain Node `.mjs` (`grade.mjs`, `run.mjs`) over `git`; tests with Vitest (`grade.test.ts` on a throwaway repo, `harness.test.ts` on `.claude/skills` and `.claude/agents`).

**Owns:** `fixtures/<name>/fixture.json` (task, skill, target IDs, projects, `base` = the repo snapshot, `head` = a recorded agent run) and `results/` (one JSON per fixture, the score table in `results/README.md`).

**Local commands:** `pnpm eval <fixture>` (static checks on `base..head`) · `pnpm eval <fixture> --checks` (also typecheck, lint and test in a temporary worktree at `head`; needs network for `pnpm install`) · `pnpm eval <fixture> --head <commit>` (grade a new run) · `pnpm nx run evals:test`.

**Local pitfalls**
- Grading reads commits with `git grep` / `git diff`; it never touches your working tree. Commit an agent's run (or use a worktree) before grading it.
- Each forbidden pattern has a scope (`FORBIDDEN[].applies`): app rules in app source only, H10 in `apps/e2e`, H4 in test files. Docs and test helpers may mention `fetch(`.
- The Day 7/8 runs are **baselines** ("none" skill version: built before the skills existed) and score 100%: the graders catch rule breaks, missing tests, statuses and states, not design quality. Add sharper checks before relying on small score differences.
- `region-column` has no recorded run yet (no `head`); it's the demo task (SPEC.md §15 step 5). Run it after the demo and record it with `--head`.
- `harness.test.ts` pins the §11.3 tool limits; changing an agent's tools means changing SPEC.md §11.3 and that test together.
