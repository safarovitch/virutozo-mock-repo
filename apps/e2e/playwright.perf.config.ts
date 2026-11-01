import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { gatewayPort } from '../../tools/gateway-port.mjs';

// ci/perf (NFR-PERF-5, D5-21): long tasks while scrolling the 10,000-tenant list, Chromium with 4× CPU
// throttling. One worker so runs don't compete for the CPU. It reports and never fails a PR.
const PORT = gatewayPort();
const REPO = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig({
  testDir: './perf',
  testMatch: '*.perf.ts',
  outputDir: '../../test-results/perf',
  workers: 1,
  retries: 0,
  timeout: 15 * 60_000,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}`, ...devices['Desktop Chrome'] },
  projects: [{ name: 'chromium' }],
  webServer: {
    command: 'pnpm e2e:stack',
    cwd: REPO,
    url: `http://localhost:${PORT}/remotes.json`,
    env: { GATEWAY_PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
