---
name: write-e2e
description: Write Playwright journeys for Nimbus Console - role selectors, web-first assertions, no sleeps, seeded data, the exclusive project for shared state, axe checks. Use when an AC needs the real stack (gateway, cookie session, WebSocket, remotes).
---

# Write an e2e test

Read `apps/e2e/AGENTS.md` and `apps/e2e/src/support.ts` first.

- **Where:** `apps/e2e/src/<area>.spec.ts` for tests that only read; `<area>.exclusive.spec.ts` for anything that changes data other sessions see (acme's VMs, buckets, status, usage, the RUM rate window). Exclusive files run after the parallel suite with one worker and call `resetSeed(request)` in `afterAll` (and `beforeEach` when each test needs the seed).
- **Sign-in:** `signIn(page, role)` (real login page). Test-only setup through `api(page, method, path, body)` or `/api/__test/*` (`expireSession`, `set-usage`, `fail-next-task`, `reset`); never use the UI under test as setup.
- **Selectors:** `getByRole` with names (`{ exact: true }` when one name contains another), `getByLabel`, `getByText` only for messages. No CSS classes (H10). Scope to a region when text repeats (the toast region also has `role="alert"`; filter alerts by text).
- **Waiting:** web-first assertions (`toBeVisible`, `toHaveURL`, `toContainText`) and `expect.poll` for server state. Never `waitForTimeout` (lint `nimbus/no-playwright-sleep`).
- **Seed data:** `specs/mock-data.md` (acme: 40 VMs, 15 buckets, 82% storage; `vm_01` = web-01; `acme-scratch` empty, `acme-backups` not). Each VM-mutating test owns one VM (`ensureRunning`).
- **Multi-tab / multi-user:** two pages in one context share the cookie; `browser.newContext()` is another user. Wait for a page to finish booting before acting in another.
- **Beacons:** a `sendBeacon` body is readable only with `page.route` interception.
- **Accessibility:** `expectNoA11yViolations(page)` on new pages.
- **Title:** starts with the AC or journey ID (`AC-STO-2.4: …`, `E2E-9` in the title text).
- **Run:** `pnpm e2e --grep "AC-STO-2"`. Builds are `dist-e2e` (BUG-5); a stack already on the port is reused (`GATEWAY_PORT` to pick another).
