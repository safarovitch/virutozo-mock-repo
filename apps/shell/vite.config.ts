/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import { reactShared } from '../../tools/mf/shared';

const DEV_MANIFEST = fileURLToPath(new URL('../../config/remotes.dev.json', import.meta.url));

/** Serves config/remotes.dev.json at /remotes.json in dev (SPEC.md §2.2). The gateway serves the other manifest. */
function devRemotesManifest(): Plugin {
  return {
    name: 'nimbus-dev-remotes-manifest',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/remotes.json', (_req, res) => {
        res.setHeader('content-type', 'application/json');
        res.end(readFileSync(DEV_MANIFEST));
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  define: { 'import.meta.env.VITE_TEST_HOOKS': JSON.stringify(mode !== 'production') },
  server: {
    port: 4200,
    strictPort: true,
    proxy: { '/api': { target: 'http://localhost:4000', ws: true } }, // same-origin API in dev (ADR-0005)
  },
  preview: { port: 4200, strictPort: true },
  build: { target: 'es2022' },
  plugins: [
    react(),
    devRemotesManifest(),
    federation({
      name: 'shell',
      remotes: {}, // registered at runtime from /remotes.json (ADR-0001 R3)
      shared: reactShared(),
      hostInitInjectLocation: 'entry', // no inline script, so the CSP can stay script-src 'self'
      dts: false,
    }),
  ],
  test: { include: ['src/**/*.test.ts', 'src/**/*.test.tsx'], environment: 'node' }, // component tests opt into jsdom per file
}));
