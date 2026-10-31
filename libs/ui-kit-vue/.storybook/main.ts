import type { StorybookConfig } from '@storybook/vue3-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.ts'],
  framework: { name: '@storybook/vue3-vite', options: {} },
  addons: ['@storybook/addon-vitest'],
  core: { disableTelemetry: true },
};
export default config;
