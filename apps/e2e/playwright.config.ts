import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { gatewayPort } from '../../tools/gateway-port.mjs';

// The gateway serves e2e-mode builds on one origin (ADR-0005). GATEWAY_PORT (default 8080, local
// override in `.env`) is resolved once here and passed to the stack, so baseURL, the gateway and
// APP_ORIGINS all use the same port.
const PORT = gatewayPort();
const REPO = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig({
  testDir: './src',
  retries: 0, // TEST-4: no retries into green
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }], // PR suite: Chromium (SPEC.md §10)
  webServer: {
    command: 'pnpm e2e:stack',
    cwd: REPO,
    url: `http://localhost:${PORT}/remotes.json`,
    env: { GATEWAY_PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
