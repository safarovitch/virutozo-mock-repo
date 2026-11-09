// ci/no-test-hooks (SPEC.md §2.2, §12): a production build must contain no test hooks.
// Run after building every frontend in production mode: fails if `__crash` or `/__test/` appears in any bundle.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const APPS = ['shell', 'tenants', 'storage', 'compute'];
const FORBIDDEN = ['__crash', '/__test/'];

/** @param {string} dir @returns {string[]} */
function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

const hits = [];
for (const app of APPS) {
  const dist = path.join(REPO, 'apps', app, 'dist');
  for (const file of files(dist).filter((f) => /\.(js|mjs|html|css)$/.test(f))) {
    const text = readFileSync(file, 'utf8');
    for (const needle of FORBIDDEN) if (text.includes(needle)) hits.push(`${path.relative(REPO, file)} contains "${needle}"`);
  }
}

if (hits.length) {
  console.error(`[nimbus][ci] test hooks found in production bundles:\n${hits.join('\n')}`);
  process.exit(1);
}
console.log(`[nimbus][ci] no test hooks in production bundles (${APPS.join(', ')})`);
