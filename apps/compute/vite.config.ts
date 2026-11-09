/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { federation } from '@module-federation/vite';
import { vueShared } from '../../tools/mf/shared';

const PORT = 4203;

export default defineConfig(({ command, mode }) => ({
  // Behind the gateway the remote lives at /remotes/compute/ (ADR-0001 R3, ADR-0005).
  base: command === 'build' ? '/remotes/compute/' : '/',
  define: { 'import.meta.env.VITE_TEST_HOOKS': JSON.stringify(mode !== 'production') },
  server: { port: PORT, strictPort: true, origin: `http://localhost:${PORT}` },
  preview: { port: PORT, strictPort: true },
  build: { target: 'es2022' },
  plugins: [
    vue(),
    federation({
      name: 'compute',
      filename: 'remoteEntry.js',
      exposes: { './mount': './src/mount.ts' },
      shared: vueShared(),
      dts: false,
    }),
  ],
  test: { include: ['src/**/*.test.ts'], environment: 'jsdom', setupFiles: ['src/testing/setup.ts'] },
}));
