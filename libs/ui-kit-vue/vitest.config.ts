import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

// Unit and story smoke tests in jsdom; play functions run in Chromium (vitest.storybook.config.ts).
export default defineConfig({
  plugins: [vue()],
  test: { include: ['src/**/*.test.ts'], environment: 'jsdom', setupFiles: ['src/test-setup.ts'] },
});
