import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { gatewayPort } from '../../tools/gateway-port.mjs';

// The gateway serves e2e-mode builds on one origin (ADR-0005). GATEWAY_PORT (default 8080, local
// override in `.env`) is resolved once here and passed to the stack, so baseURL, the gateway and
// APP_ORIGINS all use the same port.
const PORT = gatewayPort();
const REPO = fileURLToPath(new URL('../../', import.meta.url));
// Nightly (ci/nightly-e2e, SPEC.md §10): Chromium, Firefox and WebKit over HTTPS (gateway TLS=1 with a
// throwaway self-signed certificate), so `Secure` cookies behave the same in every browser (ADR-0005).
const NIGHTLY = process.env.NIGHTLY === '1';
const TLS = process.env.TLS === '1';
const EXCLUSIVE = /\.exclusive\.spec\.ts$/;
const ORIGIN = `${TLS ? 'https' : 'http'}://localhost:${PORT}`;

export default defineConfig({
  testDir: './src',
  retries: 0, // TEST-4: no retries into green
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: ORIGIN,
    trace: 'retain-on-failure',
    ignoreHTTPSErrors: TLS,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: EXCLUSIVE }, // PR suite: Chromium (SPEC.md §10)
    ...(NIGHTLY
      ? [
          { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: EXCLUSIVE },
          { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: EXCLUSIVE },
        ]
      : []),
    // D6-16: tests that change data every other test reads (suspending acme) run after the parallel
    // projects have finished, one at a time.
    { name: 'exclusive', use: { ...devices['Desktop Chrome'] }, testMatch: EXCLUSIVE, workers: 1, dependencies: NIGHTLY ? ['chromium', 'firefox', 'webkit'] : ['chromium'] },
  ],
  webServer: {
    command: 'pnpm e2e:stack',
    cwd: REPO,
    url: `${ORIGIN}/remotes.json`,
    ignoreHTTPSErrors: TLS,
    env: { GATEWAY_PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
