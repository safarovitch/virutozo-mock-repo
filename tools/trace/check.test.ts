import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkTrace, codeMask, collectTests, implementsIds } from './check.ts';
import { leadingId, loadRegistry } from './ids.ts';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A throwaway repo: specs, a retired list, a workflow and test files. */
function repo(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'trace-'));
  dirs.push(dir);
  const base: Record<string, string> = {
    'specs/features/SPEC-TEN-1.md': [
      '| ID | Criterion | Status |',
      '|---|---|---|',
      '| **AC-TEN-1.1** | rows | `done` |',
      '| **AC-TEN-1.2** | search | `in-progress` |',
      '| **AC-TEN-1.3** | sort | `planned` |',
    ].join('\n'),
    'specs/tech-tasks.md': '| TECH-5 | `in-progress` | CI | x | x | tests titled `TECH-5:` · `verify: ci/trace-check` |\n| TECH-11 | `planned` | size | x | x | `verify: ci/size` |',
    'specs/shared/realtime.md': '| RT-7 | cleanup |\n- **WS-1** reconnect',
    'specs/retired-ids.md': '| Retired ID | Retired in |\n|---|---|\n| AC-TEN-1.8 | v1.4 |',
    'specs/mock-data.md': '| `a` | A | x | `draft` |\n| `b` | B | x | `accepted` |',
    '.github/workflows/ci.yml': 'jobs:\n  trace:\n    name: ci/trace-check\n',
    'docs/adr/ADR-0007-tests.md': '# ADR-0007',
  };
  for (const [file, text] of Object.entries({ ...base, ...files })) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), text);
  }
  return dir;
}

describe('trace:check', () => {
  it('TECH-5: reads AC and TECH statuses, rule IDs, ADRs and retired IDs from the specs', () => {
    const registry = loadRegistry(repo({}));
    expect(registry.tracked.get('AC-TEN-1.1')).toEqual({ status: 'done', file: 'specs/features/SPEC-TEN-1.md' });
    expect(registry.tracked.get('TECH-5')?.status).toBe('in-progress');
    expect(registry.verify.get('TECH-5')).toBe('ci/trace-check');
    expect([...registry.known]).toEqual(expect.arrayContaining(['RT-7', 'WS-1', 'ADR-0007', 'AC-TEN-1.3']));
    expect(registry.retired.has('AC-TEN-1.8')).toBe(true);
    expect(registry.known.has('AC-TEN-1.8')).toBe(false);
  });

  it('TECH-5: T3 fails a done AC without a test and passes once a test is titled with it', () => {
    const dir = repo({ 'apps/x/a.test.ts': "it('AC-TEN-1.2: searches', () => {});" });
    expect(checkTrace({ repo: dir }).errors).toEqual(['T3 AC-TEN-1.1 is done (specs/features/SPEC-TEN-1.md) but no test is titled with it']);
    const fixed = repo({ 'apps/x/a.test.ts': "it('AC-TEN-1.1: at most 60 rows', () => {});" });
    expect(checkTrace({ repo: fixed }).errors).toEqual([]);
  });

  it('TECH-5: a skipped test does not count for T3, and .only is an error', () => {
    const dir = repo({ 'apps/x/a.test.ts': "it.skip('AC-TEN-1.1: rows', () => {});\ntest.only('RT-7: cleanup', () => {});" });
    const { errors } = checkTrace({ repo: dir });
    expect(errors).toContain('T3 AC-TEN-1.1 is done (specs/features/SPEC-TEN-1.md) but no test is titled with it');
    expect(errors.some((e) => e.includes('focused test (.only)'))).toBe(true);
  });

  it('TECH-5: T4 rejects unknown and retired IDs, and TEST-1 a title without an ID', () => {
    const dir = repo({ 'apps/x/a.test.ts': ["it('AC-TEN-1.1: ok', () => {});", "it('AC-TEN-2.9: typo', () => {});", "it('AC-TEN-1.8: retired', () => {});", "it('renders', () => {});"].join('\n') });
    const { errors } = checkTrace({ repo: dir });
    expect(errors).toEqual([
      'T4 apps/x/a.test.ts:2: unknown ID AC-TEN-2.9',
      'T4 apps/x/a.test.ts:3: AC-TEN-1.8 is retired (specs/retired-ids.md)',
      'TEST-1 apps/x/a.test.ts:4: title doesn\'t start with an ID: "renders"',
    ]);
  });

  it('TECH-5: T5 reports planned items without failing, and a planned item\'s verify job may not exist yet', () => {
    const result = checkTrace({ repo: repo({ 'apps/x/a.test.ts': "it('AC-TEN-1.1: ok', () => {});" }) });
    expect(result.report.planned).toEqual(['AC-TEN-1.3', 'TECH-11']);
    expect(result.errors).toEqual([]);
  });

  it('TECH-5: an in-progress item whose verify job is missing fails', () => {
    const dir = repo({ '.github/workflows/ci.yml': 'jobs: {}', 'apps/x/a.test.ts': "it('AC-TEN-1.1: ok', () => {});" });
    expect(checkTrace({ repo: dir }).errors).toEqual(["TECH-5: verify job ci/trace-check isn't defined in .github/workflows"]);
  });

  it('TECH-5: T1 and T2 check the PR description\'s Implements line', () => {
    const dir = repo({ 'apps/x/a.test.ts': "it('AC-TEN-1.1: ok', () => {});" });
    expect(checkTrace({ repo: dir, prBody: 'Fixes stuff' }).errors).toContain('T1 the PR description has no "Implements:" line with a known ID');
    const { errors } = checkTrace({ repo: dir, prBody: 'Implements: SPEC-TEN-1, AC-TEN-1.1, AC-TEN-1.2, AC-TEN-1.3' });
    expect(errors).toEqual([
      'T2 AC-TEN-1.2 is listed in Implements: but no test is titled with it',
      'T2 AC-TEN-1.3 is listed in Implements: but its status is still planned',
      'T2 AC-TEN-1.3 is listed in Implements: but no test is titled with it',
    ]);
  });

  it('TECH-5: T6 needs a test titled with the bug ID', () => {
    const dir = repo({ 'specs/bugs.md': '| BUG-3 | flaky |', 'apps/x/a.test.ts': "it('AC-TEN-1.1: ok', () => {});" });
    expect(checkTrace({ repo: dir, prBody: 'Implements: BUG-3' }).errors).toEqual(['T6 BUG-3: a bug fix needs a test titled with its ID']);
  });

  it('TECH-5: MSG-4 warns while §10 messages are draft', () => {
    expect(checkTrace({ repo: repo({ 'apps/x/a.test.ts': "it('AC-TEN-1.1: ok', () => {});" }) }).warnings).toEqual(['MSG-4 1 message rows in specs/mock-data.md §10 are still draft']);
  });

  it('TECH-5: test code inside strings and comments is not a test; story play names are', () => {
    const dir = repo({
      '.claude/hooks/__tests__/h.test.mjs': ["it('TECH-7: blocks', () => {", "  const fixture = 'it(\"x\", () => {})';", '  // it("y")', '});'].join('\n'),
      'libs/ui/a.stories.tsx': "export const A = { name: 'TECH-6: plays', tags: ['play'] };\nexport const B = { name: 'Plain state' };",
    });
    expect(collectTests(dir).map((t) => t.title).sort()).toEqual(['TECH-6: plays', 'TECH-7: blocks']);
  });

  it('TECH-5: helpers parse leading IDs, Implements lines and code positions', () => {
    expect(leadingId('AC-TEN-1.2: typing')).toBe('AC-TEN-1.2');
    expect(leadingId('NFR-A11Y-1: no violations')).toBe('NFR-A11Y-1');
    expect(leadingId('E2E-15: deep links')).toBe('E2E-15');
    expect(leadingId('Tenants renders')).toBeNull();
    expect(implementsIds('**Implements:** SPEC-TEN-1, AC-TEN-1.2, TECH-5')).toEqual(['SPEC-TEN-1', 'AC-TEN-1.2', 'TECH-5']);
    const mask = codeMask("a('b') // c");
    expect([...mask.slice(0, 3)]).toEqual([1, 1, 1]);
    expect(mask[3]).toBe(0);
    expect(mask[8]).toBe(0);
  });
});
