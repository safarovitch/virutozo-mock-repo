// Storybook interaction tests in Chromium: only stories tagged `play` (named with an ID, H5).
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  plugins: [vue(), storybookTest({ configDir: fileURLToPath(new URL('.storybook', import.meta.url)), tags: { include: ['play'] } })],
  test: {
    name: 'storybook-vue',
    browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: 'chromium' }] },
  },
});
