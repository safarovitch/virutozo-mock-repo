# apps/e2e — local guide

**Purpose:** Playwright journeys against the gateway serving `e2e`-mode builds (SPEC.md §10).

**Framework and key libraries:** Playwright 1.64, Chromium on PRs (nightly adds Firefox and WebKit over HTTPS).

**Owns:** `playwright.config.ts` (starts `pnpm e2e:stack` through `webServer`; `NIGHTLY=1 TLS=1` adds Firefox and WebKit over HTTPS), the journeys E2E-1…16, the TECH-1 smoke tests, and `perf/` with `playwright.perf.config.ts` (`pnpm perf`, NFR-PERF-5, `ci/perf`).

**Local commands:** `pnpm e2e` · `GATEWAY_PORT=8090 pnpm e2e` (or `.env`, see `.env.example`) when 8080 is busy · `pnpm e2e --grep "AC-TEN-2"`.

**Local pitfalls**
- No `waitForTimeout`, no CSS-class selectors; use roles and web-first assertions (H10).
- `retries: 0` stays (ADR-0007); a flaky test gets a `BUG-*`, not a retry.
- Simulate remote failures with `page.route`, not env vars (SPEC-SHL-4).
- Areas need a session: use `signIn(page, role)` from `src/support.ts` (through the real login page); `expectNoA11yViolations(page)` on every new page (NFR-A11Y-1).
- `getByRole('alert')` also matches the toast region's empty live region: filter by text or scope to the page.
- A busy `GATEWAY_PORT` makes `pnpm e2e` fail fast with `EADDRINUSE` (Apache holds 8080 on some Macs); set `GATEWAY_PORT=8090`. `baseURL` comes from `tools/gateway-port.mjs`; never hard-code the port. Use Node 22 (`nvm use`): Node 20 can't expand the `test:hooks` glob.
- Workers share one mock-api: don't change data other tests read (e.g. `t_acme`'s quotas or status).
- Anything acme's sessions can see goes in a `*.exclusive.spec.ts` (project `exclusive`: after the parallel projects, one worker, `resetSeed` in `afterAll`): real VM tasks (task center counts, `getTask` fetches), suspending acme, and `/api/__test/emit` events for acme. Since SPEC-SHL-8 an emitted `tenant.updated` changes every acme session's header and disables its actions (A6-05).
- On `/compute`, wait for the VM table before expiring the session: Compute's own first requests would otherwise get the 401 (A6-06).
- `PerformanceObserver` doesn't see code run by `page.evaluate`; plant measurable work with `setTimeout` inside the page.
