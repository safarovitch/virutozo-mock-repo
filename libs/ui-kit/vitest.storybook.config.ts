// Storybook interaction tests (§8.2, SPEC.md §10): stories tagged `play` run their `play` function in
// Chromium. Their names start with a TECH/AC ID (H5); plain state stories are covered by
// src/stories.test.tsx in jsdom instead. CI job: ci/storybook-test.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  plugins: [storybookTest({ configDir: fileURLToPath(new URL('.storybook', import.meta.url)), tags: { include: ['play'] } })],
  test: {
    name: 'storybook',
    browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: 'chromium' }] },
  },
});
