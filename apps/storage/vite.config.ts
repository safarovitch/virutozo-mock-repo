/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import { reactShared } from '../../tools/mf/shared';

const PORT = 4202;

export default defineConfig(({ command, mode }) => ({
  // Behind the gateway the remote lives at /remotes/storage/ (ADR-0001 R3, ADR-0005).
  base: command === 'build' ? '/remotes/storage/' : '/',
  define: { 'import.meta.env.VITE_TEST_HOOKS': JSON.stringify(mode !== 'production') },
  server: { port: PORT, strictPort: true, origin: `http://localhost:${PORT}` },
  preview: { port: PORT, strictPort: true },
  build: { target: 'es2022' },
  plugins: [
    react(),
    federation({
      name: 'storage',
      filename: 'remoteEntry.js',
      exposes: { './mount': './src/mount.tsx' },
      shared: reactShared(),
      dts: false,
    }),
  ],
  test: { passWithNoTests: true },
}));
