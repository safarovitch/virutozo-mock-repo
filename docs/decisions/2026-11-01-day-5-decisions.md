# Day 5 — Decisions

- **Status:** Accepted · **Date:** 2026-11-01 · **Owner:** Rasul Idiev
- **Input:** `docs/reviews/2026-11-01-day-5-spec-check.md`

## Part 1 — owner decisions

| ID | Decision | Applied in |
|---|---|---|
| D5-01 | **(a)** Two states per column, never "unsorted". The first click on a new column uses its natural direction (*Name* ascending; *Created* and *Storage used* descending), every further click flips it. `sort=name` is the default and is left out of the URL. | SPEC-TEN-1 behaviour |
| D5-02 | **(a)** A live `tenant.updated` updates the row in place, even if it no longer matches the status filter; count and membership are corrected at the next refetch (filter change, *Retry*, reconnect). | SPEC-TEN-1 behaviour |
| D5-03 | **(a)** Day 5's row menu has *Open details*, *View VMs*, *View buckets*. *Suspend*/*Resume* (row menu and drawer) arrive with SPEC-TEN-4 on Day 7. AC-TEN-3.11 stays `in-progress` until then. | SPEC-TEN-1, SPEC-TEN-3 behaviour |
| D5-04 | **(a)** Filter and sort changes push a history entry. Search pushes once when a new search starts and replaces while the user keeps typing. URL corrections replace. | `specs/shared/url-conventions.md` |
| D5-05 … D5-23 | Accepted as proposed in the spec check (the agent decides missing details). | see the review file |
| — | **Push and PR approved:** the agent may push `day-1-foundation` to `origin` and open a PR at the end of the day, so TECH-5's jobs are shown running on GitHub. | TECH-5 |

## Part 2 — decisions the agent made while building Day 5

(Recorded under the "What blocks building" rule, for review at the end of the day.)

| ID | Decision (agent) | Why |
|---|---|---|
