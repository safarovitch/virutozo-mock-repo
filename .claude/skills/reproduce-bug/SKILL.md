---
name: reproduce-bug
description: From a bug report to a fix - write the failing BUG-n test first (unit or e2e), confirm it fails for the reported reason, fix, re-run against the stack. Use for any reported defect, including harness and tooling bugs.
---

# Reproduce and fix a bug

1. **ID.** Add a row to `specs/bugs.md` (`| BUG-<n> | what's wrong and its effect | found | fixed |`), the next free number. trace:check (T6) needs a test titled with it.
2. **Failing test first** (SPEC.md §3, TEST-2), at the smallest level that shows it:
   - logic → unit test next to the code;
   - a component → component test on the area's fake API;
   - only visible through the gateway, cookie, socket or several remotes → Playwright (see `write-e2e`; the `bug-reproducer` subagent can do this part).
   Title: `BUG-<n>: <the correct behaviour>`. Run it and **see it fail for the reported reason**, not for a typo.
3. **Fix** the smallest thing that makes it pass. Generated code, hooks and settings are off limits (H1, H15): if the bug is there, stop and report.
4. **Re-run** the test, the project's tests, and the e2e journeys that touch the area. Nothing else may change (H4: never edit an existing assertion to make it pass).
5. **Record** it: the fixed column in `specs/bugs.md`, an entry in `docs/agent-log.md` if an agent caused it, and the day's decisions file if the fix changes behaviour. A pitfall others will hit goes into the project's local `AGENTS.md`.
