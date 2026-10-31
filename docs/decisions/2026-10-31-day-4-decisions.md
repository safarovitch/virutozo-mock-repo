# Day 4 — Decisions

- **Status:** Accepted · **Date:** 2026-10-31 · **Owner:** Rasul Idiev
- **Input:** `docs/reviews/2026-10-31-day-4-spec-check.md`

## Part 1 — owner decisions

| ID | Decision | Applied in |
|---|---|---|
| D4-01 | **(a)** The badge counts `queued` + `running` tasks. At 0 there's no badge and the button is named `tasks.title` "Tasks"; at ≥ 1 the badge shows the number and the name is "Tasks, {count} running task(s)" (`shell.runningTasks_one/_other`). Queued tasks are listed under *Running* with a 0 % bar. | SPEC-TSK-1 behaviour |
| D4-02 | **(a)** A disclosure panel under the header button (same pattern as the user menu: Escape and outside click close it, focus returns to the button). Two lists, *Running* and *Recent*; at most the 50 newest tasks of the last 24 h, no "load more". Empty: `tasks.empty`. | SPEC-TSK-1 behaviour |
| D4-03 | **(a)** The connection indicator is always visible: a dot plus the state text in a `role="status"` element named `connections.label`. | `specs/shared/realtime.md` WS-4 |
| D4-04 … D4-15 | Accepted as proposed in the spec check (the agent decides missing details). | see the review file |

## Part 2 — decisions the agent made while building Day 4

(Recorded under the "What blocks building" rule, for review at the end of the day.)

| ID | Decision (agent) | Why |
|---|---|---|
