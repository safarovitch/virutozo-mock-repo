# Bugs

`BUG-*` IDs (SPEC.md §3.2). Normally a GitHub issue; this repo has no issue tracker yet, so bugs are listed here, where `trace:check` reads them. Every fix starts with a failing test titled with the ID (T6).

| ID | Bug | Found | Fixed |
|---|---|---|---|
| BUG-4 | `tools/trace` `codeMask` read a regex literal containing a quote (`/can't/`) as the start of a string, so the test titles after it in that file disappeared from the report (A7-12). | Day 7 | Day 8 (D8-03) |
| BUG-5 | `build` (production) and `build-e2e` wrote the same `apps/<app>/dist`. After `check:no-test-hooks`, a cached `build-e2e` didn't restore the e2e output, so `pnpm e2e` served production remotes without `/__crash` (A7-13). | Day 7 | Day 8 (D8-03) |
