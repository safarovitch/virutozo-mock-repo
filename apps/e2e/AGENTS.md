# apps/e2e — local guide

**Purpose:** Playwright journeys against the gateway serving `e2e`-mode builds (SPEC.md §10).

**Framework and key libraries:** Playwright 1.64, Chromium on PRs (nightly adds Firefox and WebKit over HTTPS).

**Owns:** `playwright.config.ts` (starts `pnpm e2e:stack` through `webServer`), the journeys E2E-1…16 and the TECH-1 smoke tests.

**Local commands:** `pnpm e2e` · `PORT=8090 pnpm e2e` when 8080 is busy · `pnpm e2e --grep "AC-TEN-2"`.

**Local pitfalls**
- No `waitForTimeout`, no CSS-class selectors; use roles and web-first assertions (H10).
- `retries: 0` stays (ADR-0007); a flaky test gets a `BUG-*`, not a retry.
- Simulate remote failures with `page.route`, not env vars (SPEC-SHL-4).
- A busy `PORT` makes `pnpm e2e` fail fast with `EADDRINUSE` (Apache holds 8080 on some Macs); rerun with `PORT=8090`. Use Node 22 (`nvm use`): Node 20 can't expand the `test:hooks` glob.
