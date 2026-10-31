# Nimbus Console — starter kit

Everything the coding agent needs **before** it writes code. Unzip into an empty folder, `git init`, commit, then follow the steps below.

## What's here

| File | Purpose | Status |
|---|---|---|
| `SPEC.md` | Product + engineering spec (v1.1) | ready |
| `AGENTS.md` | Rules and workflow every agent reads first | ready |
| `.claude/settings.json` + `.claude/hooks/` | Claude Code hooks: block generated-file edits, block test weakening, block destructive commands, typecheck+lint after each edit | tested (18 cases) |
| `contracts/main.tsp` | Full API contract, 22 operations, error codes, WS events | compiles with TypeSpec 1.17 |
| `contracts/openapi.yaml` | Compiled contract | passes Redocly lint; Orval client from it passes strict `tsc` |
| `specs/mock-data.md` | Demo users, plans, seed data, task timings, error messages | ready |
| `docs/adr/ADR-0001-…` | Vite + `@module-federation/vite` decision and pinned versions | ready |
| `docs/reference/orval.config.mjs` | Verified client-generation config for Day 2 | verified |
| `prompts/day-1-foundation.md` | Prompt for the agent: workspace, shell, 3 remotes, e2e smoke, CI | ready |
| `prompts/day-2-contract.md` | Prompt: contract package, generated clients, mock API | ready |

## Steps

1. **Set up the repo.**
   ```bash
   mkdir nimbus-console && cd nimbus-console
   unzip ../nimbus-console-starter-kit.zip
   git init && git add -A && git commit -m "chore: starter kit (spec, contract, harness)"
   ```
   Use Node 22 (`nvm use`) and enable pnpm (`corepack enable`).
2. **Read the contract yourself** (`contracts/main.tsp`, about 30 minutes). This is the review step the job description talks about. Change anything you disagree with *now*, before code depends on it.
3. **Run the spec review.** Ask your agent:
   > Read SPEC.md, AGENTS.md, contracts/main.tsp and specs/mock-data.md. Act as the `spec-reviewer` from SPEC.md §11.3. List every gap, ambiguity, contradiction or untestable acceptance criterion, with IDs. Don't change files.

   Fix the findings in the spec, commit, and keep the list; it's an interview talking point.
4. **Day 1.** Paste `prompts/day-1-foundation.md` into the agent. Approve its plan, let it build, check the acceptance list yourself.
5. **Day 2.** Same with `prompts/day-2-contract.md`.
6. **Keep a log** in `docs/agent-log.md` from the first prompt: every mistake the agent made, which hook/rule/test caught it (or didn't), and what you changed in the harness. That log becomes the README section "Where the agent failed and what I changed".

## Notes
- The hooks are for Claude Code. For Cursor or Codex, copy the AGENTS.md rules into their rules files; the git hooks (lefthook, set up on Day 1) and CI still enforce the important rules for any tool.
- The post-edit hook does nothing until the workspace is installed (Day 1), so it won't block scaffolding.
- To allow one intentional test change (e.g. a requirement changed), create `.claude/allow-test-change`, make the change, then delete the file.
