import { defineConfig } from 'vitest/config';

// Unit and story smoke tests in jsdom. Interaction (`play`) tests run in a real browser:
// vitest.storybook.config.ts (`storybook-test`, CI ci/storybook-test).
export default defineConfig({
  test: { include: ['src/**/*.test.ts', 'src/**/*.test.tsx'], environment: 'jsdom', setupFiles: ['src/test-setup.ts'] },
});
