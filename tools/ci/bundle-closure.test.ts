import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bundleClosure, htmlEntry } from './bundle-closure.mjs';

function dist(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'closure-'));
  mkdirSync(path.join(dir, 'assets'));
  for (const [name, text] of Object.entries(files)) writeFileSync(path.join(dir, name), text);
  return dir;
}

describe('bundle closure', () => {
  it('TECH-11: follows static and dynamic relative imports, once each, and skips shared-singleton fallbacks', () => {
    const dir = dist({
      'remoteEntry.js': 'import{t}from"./assets/a.js";const m=()=>import(`./assets/mount.js`);',
      'assets/a.js': 'import"./b.js";export const t=1;',
      'assets/b.js': 'import{a}from"./a.js";',
      'assets/mount.js': 'import{x}from"./_virtual_mf__x__prebuild__react-1.js";import"./_virtual_mf-localSharedImportMap_1.js";import("./ui.js");import"./_mf__loadShare__shared-1.js"',
      'assets/_mf__loadShare__shared-1.js': 'import{h}from"./b.js";if(!host)import(`./kit-fallback.js`)',
      'assets/kit-fallback.js': 'ui-kit copy',
      'assets/ui.js': 'import"https://cdn.example/x.js";',
      'assets/_virtual_mf__x__prebuild__react-1.js': 'big',
      'assets/unused.js': 'never loaded',
    });
    const names = bundleClosure(path.join(dir, 'remoteEntry.js')).map((f) => path.relative(dir, f));
    expect(names).toEqual(['remoteEntry.js', 'assets/a.js', 'assets/mount.js', 'assets/b.js', 'assets/_mf__loadShare__shared-1.js', 'assets/ui.js']);
  });

  it('TECH-11: finds the shell entry script in index.html', () => {
    const dir = dist({ 'index.html': '<script type="module" crossorigin src="/assets/index-AB.js"></script>' });
    expect(htmlEntry(dir)).toBe(path.join(dir, 'assets/index-AB.js'));
  });
});
