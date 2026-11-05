import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/vue3-vite';

// The remote's own vite.config.ts carries Module Federation; stories use a plain Vue config instead.
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.ts'],
  framework: { name: '@storybook/vue3-vite', options: { builder: { viteConfigPath: fileURLToPath(new URL('./vite.config.ts', import.meta.url)) } } },
  core: { disableTelemetry: true },
};
export default config;
