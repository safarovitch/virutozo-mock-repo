// TECH-9: the graders on a throwaway git repo with two commits (base → head).
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { score, staticChecks, type Fixture } from './grade.mjs';

function repo(baseFiles: Record<string, string>, headFiles: Record<string, string>) {
  const dir = mkdtempSync(path.join(tmpdir(), 'evals-'));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
  const write = (files: Record<string, string>) => {
    for (const [file, text] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      writeFileSync(path.join(dir, file), text);
    }
  };
  git('init', '-q');
  git('config', 'user.email', 'eval@test');
  git('config', 'user.name', 'eval');
  write(baseFiles);
  git('add', '-A');
  git('commit', '-qm', 'base');
  write(headFiles);
  git('add', '-A');
  git('commit', '-qm', 'head');
  return { dir, base: git('rev-parse', 'HEAD~1'), head: git('rev-parse', 'HEAD') };
}

const FIXTURE: Fixture = { name: 'x', skill: 'add-table-page', task: '', targets: ['AC-STO-1.1'], projects: ['storage'], ui: true, area: 'storage' };
const SPEC_DONE = '| **AC-STO-1.1** | Usage at 85% | `done` |\n';
const STORIES = 'export const List = {};\nexport const Loading = {};\nexport const Empty = {};\nexport const LoadError = {};\nexport const NoAccess = {};\n';

describe('eval graders', () => {
  it('TECH-9: a clean run passes every static check and scores 100', () => {
    const r = repo({ 'specs/features/SPEC-STO-1.md': '| **AC-STO-1.1** | Usage | `planned` |\n' }, {
      'specs/features/SPEC-STO-1.md': SPEC_DONE,
      'apps/storage/src/UsageCard.tsx': 'export const x = messageFor(problem);\n',
      'docs/notes.md': 'fetch( is only text here\n',
      'apps/storage/src/StorageArea.test.tsx': "it('AC-STO-1.1: shows 85%', () => {});\n",
      'apps/storage/src/Storage.stories.tsx': STORIES,
    });
    const checks = staticChecks(r.dir, FIXTURE, r.base, r.head);
    expect(checks.map((c) => [c.id, c.pass])).toEqual([['target tests', true], ['statuses done', true], ['no forbidden patterns', true], ['contract first (H1)', true], ['five states (H6)', true]]);
    expect(score(checks)).toBe(100);
  });

  it('TECH-9: missing tests, open statuses, forbidden patterns, generated edits and missing states each fail', () => {
    const r = repo({ 'README.md': 'x\n' }, {
      'specs/features/SPEC-STO-1.md': '| **AC-STO-1.1** | Usage | `in-progress` |\n',
      'apps/storage/src/data.ts': "export const load = () => fetch('/api/buckets');\nif (session.role === 'provider_admin') x();\n",
      'apps/storage/src/testing/fake-api.ts': "export const f = () => fetch('/x');\n", // exempt: a test fake
      'apps/e2e/src/x.spec.ts': "await page.evaluate(() => fetch('/api/__test/reset'));\nawait page.waitForTimeout(100);\n",
      'docs/notes.md': 'Use `navigator.sendBeacon` or fetch(…) with keepalive.\n',
      'libs/api-client/src/generated/model/bucket.ts': 'export type Bucket = {};\n',
      'apps/storage/src/Storage.stories.tsx': 'export const List = {};\n',
    });
    const checks = Object.fromEntries(staticChecks(r.dir, FIXTURE, r.base, r.head).map((c) => [c.id, c]));
    expect(checks['target tests']).toMatchObject({ pass: false, detail: 'no test titled AC-STO-1.1' });
    expect(checks['statuses done']).toMatchObject({ pass: false });
    expect(checks['no forbidden patterns']?.pass).toBe(false);
    expect(checks['no forbidden patterns']?.detail).toMatch(/H2 raw fetch.*data\.ts.*H3 role check/);
    expect(checks['no forbidden patterns']?.detail).not.toMatch(/fake-api|docs\/|H2 raw fetch\/axios in apps\/e2e/);
    expect(checks['no forbidden patterns']?.detail).toMatch(/H10 Playwright sleep in apps\/e2e\/src\/x\.spec\.ts/);
    expect(checks['contract first (H1)']).toMatchObject({ pass: false, detail: expect.stringContaining('libs/api-client/src/generated/model/bucket.ts') });
    expect(checks['five states (H6)']).toMatchObject({ pass: false, detail: 'no story for: loading, empty, error, no permission' });
  });

  it('TECH-9: generated files are fine when the same run changed contracts/main.tsp', () => {
    const r = repo({ 'contracts/main.tsp': 'model A {}\n' }, { 'contracts/main.tsp': 'model A { region: string }\n', 'libs/api-client/src/generated/model/a.ts': 'export type A = { region: string };\n' });
    const check = staticChecks(r.dir, { ...FIXTURE, targets: [], ui: false }, r.base, r.head).find((c) => c.id === 'contract first (H1)');
    expect(check).toMatchObject({ pass: true, detail: 'generated files follow a main.tsp change' });
  });
});
