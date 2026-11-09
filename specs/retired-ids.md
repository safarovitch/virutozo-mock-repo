# Retired IDs

Withdrawn IDs are never reused. `trace:check` rejects a test title that references any ID listed here (T4, SPEC.md §3.3).

| Retired ID | Retired in | Replaced by | Reason |
|---|---|---|---|
| AC-TEN-1.8 | v1.4 (E7) | NFR-PERF-5 | Scrolling smoothness is a target measured by the non-blocking `ci/perf` job, not an acceptance criterion |
| AC-SHL-1.11 | v1.4 (E12) | AC-SHL-1.6 | Duplicated AC-SHL-1.6 ("reloading keeps the user signed in") |
| AC-TEN-3.5 | v1.4 (E9) | AC-TEN-3.8, AC-TEN-3.9, AC-TEN-3.10 | Split by test level: mock-api integration, storage component test, e2e |
| HOOK-6 | Day 1 (D1-06) | — | The shipped hooks are the source of truth, and no "summary on agent stop" hook exists; AGENTS.md §6 asks for the summary instead |
