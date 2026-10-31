# Agent log

One entry per incident where the agent did something wrong (STARTER-KIT.md step 6). The README section "Where the agent failed and what I changed" is a curated summary of the 5–8 best entries and links here (SPEC.md §15).

Review outputs don't go here; they're saved in `docs/reviews/` with dated names.

**Entry format:** date · task / IDs · what the agent did wrong · caught by (`hook` / `lint` / `test` / `review` / `nothing`) · harness change made.

| Date | Task / IDs | What the agent did wrong | Caught by | Harness change |
|---|---|---|---|---|
| 2026-10-30 | v1.2 contract change (cookie session) | Ran `tsp compile` on the shell's default Node 20 without checking `.nvmrc` (Node 22); the build failed with an import error. | nothing (the command failed; no hook or rule checks the Node version) | E15: AGENTS.md §4 says to run `nvm use` (Node 22) before building the contract. |
| 2026-10-30 | SPEC §2.5 realtime design, `mount.ts` example | Changed the owner's comment "ADR-0001 R2" to "MF-2" and claimed R2 was one of its own review findings. ADR-0001 does have a rule R2; the agent hadn't read ADR-0001 before editing. | review (the agent noticed during the next spec review and corrected itself) | none |
| 2026-10-30 | v1.3 apply (D1–D15) | Tried to write draft files to the session scratchpad, outside the repository. | hook (`guard-paths`) | none needed; drafts went to the gitignored `tmp/` folder. |
| 2026-10-30 | v1.3 apply, contract build | Followed the prompt's `npm install` over a pnpm-created `node_modules`; npm failed. | nothing (command error) | E15: contracts use pnpm only, documented in AGENTS.md §4. |
| 2026-10-30 | v1.3 apply, SPEC.md §0 | Inserted the new rule 6 between rules 4 and 5, so the list read 1, 2, 3, 4, 6, 5. | review (V28) | none |
| 2026-10-30 | Second spec review, R14 / N6 | Wrote "see N10" for the WebSocket 401 item instead of N6. | review (the agent, when saving the review to a file) | none |
| 2026-10-30 | v1.4 apply, `prompts/day-1-foundation.md` | Added two smoke tests that no decision asked for, against the rule "change nothing no decision requires". | review (the agent's own check before finishing) | none |
| 2026-10-31 | v1.4 apply, E15 (deleting `contracts/node_modules`) | Reported that H12 **and the `guard-bash` hook** block deleting `node_modules` in `contracts/`, without reading the hook. The hook's allowlist includes `node_modules`; only H12's wording forbids it. The step was left out of AGENTS.md on that basis. | review (the agent, reading the hooks for the Day 1 spec check) | none yet; see D1-07 in `docs/reviews/2026-10-31-day-1-spec-check.md` |
| 2026-10-31 | Day 1 spec check, D1-08 (`guard-bash`, HOOK-5) | Harness bug surfaced by the agent's own work: `guard-bash` matched the whole command text, so it blocked a harmless log update that only *mentioned* `rm -rf` inside a heredoc. While fixing it, new tests found two more holes: `rm -rf dist/../apps` passed because it started with `dist/`, and `rm -rf contracts/node_modules` was wrongly blocked. | hook (false positive, noticed by the agent and reported as D1-08) | Rasul rewrote `guard-bash` to check only the parts of a command that run (heredoc bodies and quoted strings are data; `bash -c`, `eval`, `$(…)` and shell-fed heredocs are checked), blocked any path containing `..`, and added 30 tests in `.claude/hooks/__tests__/guard-bash.test.mjs`. Rule since D1-09: every hook ships with tests. |
| 2026-10-31 | D1-09, hook tests for `guard-tests` | Wrote a test title containing `xit()`; `guard-tests` blocked the file because it matches its patterns inside strings too (same class as D1-08). | hook (false positive) | none yet; reworded the title and reported it as D1-15. |
