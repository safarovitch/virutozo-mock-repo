import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-vite';

// The remote's own vite.config.ts carries Module Federation; stories use a plain React config instead.
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  framework: { name: '@storybook/react-vite', options: { builder: { viteConfigPath: fileURLToPath(new URL('./vite.config.ts', import.meta.url)) } } },
  core: { disableTelemetry: true },
};
export default config;
