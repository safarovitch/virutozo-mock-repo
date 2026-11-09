// The JS a page or a remote actually loads (NFR-PERF-1, D9-05): the import closure of an entry file in a
// production build, following static `import … from "./x.js"` and dynamic `import("./x.js")`. Shared
// singletons are loaded once by the shell, so fallback copies are skipped: the federation plugin's
// `__prebuild__` chunks, its `localSharedImportMap`, and whatever a `loadShare` chunk imports
// dynamically (it does that only when no host provides the singleton). The shell's own shared chunks
// (the ui-kit) are measured on their own budget.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const STATIC = /(?:\bfrom\s*|\bimport\s*)["'`](\.{1,2}\/[^"'`]+\.js)["'`]/g;
const DYNAMIC = /\bimport\s*\(\s*["'`](\.{1,2}\/[^"'`]+\.js)["'`]/g;
const LOAD_SHARE = /loadShare/;
const FALLBACK = /__prebuild__|localSharedImportMap/;

/**
 * @param {string} entry absolute path of the entry file
 * @param {{ skip?: RegExp }} [options]
 * @returns {string[]} absolute paths, entry first, then in discovery order
 */
export function bundleClosure(entry, { skip = FALLBACK } = {}) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const file = /** @type {string} */ (queue.shift());
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    const text = readFileSync(file, 'utf8');
    const imports = [...text.matchAll(STATIC), ...(LOAD_SHARE.test(path.basename(file)) ? [] : text.matchAll(DYNAMIC))];
    for (const m of imports) {
      const next = path.resolve(path.dirname(file), /** @type {string} */ (m[1]));
      if (!skip.test(path.basename(next))) queue.push(next);
    }
  }
  return [...seen];
}

/** The shell's entry script from its index.html (`<script type="module" src="/assets/index-….js">`). */
export function htmlEntry(distDir) {
  const html = readFileSync(path.join(distDir, 'index.html'), 'utf8');
  const src = /<script[^>]+type="module"[^>]+src="\/?([^"]+)"/.exec(html)?.[1];
  if (!src) throw new Error(`no module script in ${distDir}/index.html`);
  return path.join(distDir, src);
}
