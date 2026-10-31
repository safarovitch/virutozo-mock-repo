import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

// The gateway serves e2e-mode builds on one origin (ADR-0005). PORT defaults to 8080; override it
// when 8080 is busy locally (both the gateway and this config read it).
const PORT = Number(process.env.PORT ?? 8080);
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
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
