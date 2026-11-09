// NFR-PERF-1 bundle budgets (gzip) on the production build (`pnpm size`, CI job ci/size, TECH-11).
// What counts is what loads (D9-05): each entry's import closure without shared-singleton fallbacks
// (tools/ci/bundle-closure.mjs). Run after `nx run-many -t build -p shell tenants storage compute`.
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { bundleClosure, htmlEntry } from './tools/ci/bundle-closure.mjs';

const dist = (app) => path.resolve('apps', app, 'dist');
const remote = (app) => bundleClosure(path.join(dist(app), 'remoteEntry.js'));
// The shell's ui-kit chunk: the shared module the shell provides to every React remote (D1-11).
const uiKit = readdirSync(path.join(dist('shell'), 'assets'))
  .filter((f) => /^src-.*\.js$/.test(f))
  .map((f) => path.join(dist('shell'), 'assets', f));

export default [
  { name: 'shell initial JS', path: bundleClosure(htmlEntry(dist('shell'))), limit: '180 KB', gzip: true },
  { name: 'tenants remote', path: remote('tenants'), limit: '120 KB', gzip: true },
  { name: 'storage remote', path: remote('storage'), limit: '80 KB', gzip: true },
  { name: 'compute remote (incl. Vue)', path: remote('compute'), limit: '110 KB', gzip: true },
  { name: 'ui-kit shared chunk', path: uiKit, limit: '60 KB', gzip: true },
];
