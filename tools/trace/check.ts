// trace:check (SPEC.md §3.3, rules T1–T6; D5-20). Test titles are read statically from the source; that
// they *pass* is guaranteed by the blocking test jobs, which never retry (TEST-4).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ID_PATTERN, leadingId, loadRegistry, type Registry, type Status } from './ids.ts';

export interface TestTitle {
  file: string;
  line: number;
  title: string;
  id: string | null;
  /** `.skip`, `.todo`, `.fixme`, `xit`: present but not run, so it proves nothing. */
  skipped: boolean;
  only: boolean;
}

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.nx', 'coverage', 'tmp', 'storybook-static', 'test-results', 'playwright-report', 'tsp-output', 'fixtures']);
const TEST_FILE = /\.(test|spec|perf)\.(ts|tsx|mts|mjs|js)$|\.stories\.tsx$/;
// it('…') / test.skip("…") / xit(`…`) — the title is the first string argument.
const CALL = /\b(xit|it|test)(?:\.(only|skip|todo|fixme|fails|concurrent))?\s*\(\s*(['"`])((?:\\.|(?!\3)[^\\])*)\3/g;
// Storybook play tests: `name: 'TECH-6: …'` (only names that start with an ID count).
const STORY_NAME = /\bname:\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;

function testFiles(dir: string, repo: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (SKIP_DIRS.has(e.name)) return [];
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return testFiles(p, repo);
    return TEST_FILE.test(e.name) ? [path.relative(repo, p)] : [];
  });
}

const lineOf = (text: string, index: number) => text.slice(0, index).split('\n').length;

/**
 * Marks which characters are code (not inside a string, template literal or comment), so test code
 * that a test keeps as a string fixture (e.g. the hook tests) isn't mistaken for a test.
 */
export function codeMask(text: string): Uint8Array {
  const code = new Uint8Array(text.length);
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (c === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 2;
    } else if (c === "'" || c === '"' || c === '`') {
      code[i] = 1; // the opening quote belongs to the code around it (a title starts there)
      i++;
      let depth = 0;
      while (i < text.length && !(text[i] === c && depth === 0)) {
        if (text[i] === '\\') i++;
        else if (c === '`' && text[i] === '$' && text[i + 1] === '{') depth++;
        else if (c === '`' && text[i] === '}' && depth > 0) depth--;
        i++;
      }
      i++;
    } else {
      code[i] = 1;
      i++;
    }
  }
  return code;
}

export function collectTests(repo: string): TestTitle[] {
  const roots = ['apps', 'libs', 'tools', '.claude/hooks/__tests__'].map((d) => path.join(repo, d)).filter(existsSync);
  const titles: TestTitle[] = [];
  for (const file of roots.flatMap((r) => testFiles(r, repo))) {
    const text = readFileSync(path.join(repo, file), 'utf8');
    if (file.endsWith('.stories.tsx')) {
      for (const m of text.matchAll(STORY_NAME)) {
        const title = m[2] ?? '';
        const id = leadingId(title);
        if (id) titles.push({ file, line: lineOf(text, m.index ?? 0), title, id, skipped: false, only: false });
      }
      continue;
    }
    const code = codeMask(text);
    for (const m of text.matchAll(CALL)) {
      if (!code[m.index ?? 0]) continue; // inside a string or comment
      const [, fn, modifier, , title = ''] = m;
      titles.push({
        file,
        line: lineOf(text, m.index ?? 0),
        title,
        id: leadingId(title),
        skipped: fn === 'xit' || modifier === 'skip' || modifier === 'todo' || modifier === 'fixme',
        only: modifier === 'only',
      });
    }
  }
  return titles;
}

/** IDs in the PR body's `Implements:` line (AGENTS.md §6), e.g. "Implements: SPEC-TEN-1, AC-TEN-1.2". */
export function implementsIds(prBody: string): string[] {
  const line = /^\s*\**Implements:?\**:?\s*(.*)$/im.exec(prBody)?.[1] ?? '';
  return [...new Set([...line.matchAll(/\b(?:SPEC-[A-Z]+-\d+)\b/g)].map((m) => m[0]).concat([...line.matchAll(ID_PATTERN)].map((m) => m[0])))];
}

export interface TraceResult {
  errors: string[];
  warnings: string[];
  /** Per-status counts and the AC → test map, for the PR report (ci/report). */
  report: { counts: Record<Status, number>; covered: Record<string, number>; planned: string[]; tests: number };
}

export interface CheckOptions {
  repo: string;
  /** The PR description; enables T1, T2 and T6. */
  prBody?: string;
  registry?: Registry;
  tests?: TestTitle[];
}

export function checkTrace({ repo, prBody, registry = loadRegistry(repo), tests = collectTests(repo) }: CheckOptions): TraceResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const at = (t: TestTitle) => `${t.file}:${t.line}`;
  const covered: Record<string, number> = {};
  for (const t of tests) if (t.id && !t.skipped) covered[t.id] = (covered[t.id] ?? 0) + 1;

  // TEST-1 / T4: every title starts with a known, non-retired ID; no focused tests.
  for (const t of tests) {
    if (t.only) errors.push(`${at(t)}: focused test (.only) "${t.title}"`);
    if (!t.id) errors.push(`TEST-1 ${at(t)}: title doesn't start with an ID: "${t.title}"`);
    else if (registry.retired.has(t.id)) errors.push(`T4 ${at(t)}: ${t.id} is retired (specs/retired-ids.md)`);
    else if (!registry.known.has(t.id)) errors.push(`T4 ${at(t)}: unknown ID ${t.id}`);
  }

  // T3: everything `done` still has a test. T5: planned items are reported, never fail.
  const counts: Record<Status, number> = { planned: 0, 'in-progress': 0, done: 0 };
  const planned: string[] = [];
  for (const [id, { status, file }] of registry.tracked) {
    counts[status]++;
    if (status === 'planned') planned.push(id);
    if (status === 'done' && !covered[id]) errors.push(`T3 ${id} is done (${file}) but no test is titled with it`);
  }

  // verify: lines name CI jobs that must exist (specs/tech-tasks.md).
  const workflows = path.join(repo, '.github/workflows');
  const jobs = existsSync(workflows) ? readdirSync(workflows).map((f) => readFileSync(path.join(workflows, f), 'utf8')).join('\n') : '';
  for (const [id, job] of registry.verify) if (registry.tracked.get(id)?.status !== 'planned' && !new RegExp(`^\\s*name:\\s*${job.replace('/', '\\/')}\\s*$`, 'm').test(jobs)) errors.push(`${id}: verify job ${job} isn't defined in .github/workflows`);

  // T1, T2, T6 need the PR description.
  if (prBody !== undefined) {
    const ids = implementsIds(prBody);
    const knownIds = ids.filter((id) => registry.known.has(id) || /^SPEC-[A-Z]+-\d+$/.test(id));
    if (!knownIds.length) errors.push('T1 the PR description has no "Implements:" line with a known ID');
    for (const id of ids.filter((i) => i.startsWith('AC-') || i.startsWith('TECH-'))) {
      const entry = registry.tracked.get(id);
      if (!entry) errors.push(`T2 ${id} is listed in Implements: but isn't defined`);
      else if (entry.status === 'planned') errors.push(`T2 ${id} is listed in Implements: but its status is still planned`);
      if (!covered[id]) errors.push(`T2 ${id} is listed in Implements: but no test is titled with it`);
    }
    for (const id of ids.filter((i) => i.startsWith('BUG-'))) if (!covered[id]) errors.push(`T6 ${id}: a bug fix needs a test titled with its ID`);
  }

  // MSG-4: warn while any §10 message is still a draft.
  const mockData = path.join(repo, 'specs/mock-data.md');
  if (existsSync(mockData)) {
    const drafts = readFileSync(mockData, 'utf8').split('\n').filter((l) => /^\|.*\|\s*`draft`\s*\|\s*$/.test(l)).length;
    if (drafts) warnings.push(`MSG-4 ${drafts} message rows in specs/mock-data.md §10 are still draft`);
  }

  return { errors, warnings, report: { counts, covered, planned, tests: tests.length } };
}

/** Markdown summary for the job summary and the PR comment. */
export function formatReport(result: TraceResult, registry: Registry): string {
  const { counts, covered, planned, tests } = result.report;
  const rows = [...registry.tracked.entries()]
    .filter(([, v]) => v.status !== 'planned')
    .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))
    .map(([id, v]) => `| ${id} | \`${v.status}\` | ${covered[id] ?? 0} |`);
  return [
    '## Trace (AC → tests)',
    '',
    `${tests} test titles · done ${counts.done} · in progress ${counts['in-progress']} · planned ${counts.planned}`,
    '',
    result.errors.length ? `**${result.errors.length} errors**\n\n${result.errors.map((e) => `- ${e}`).join('\n')}` : '**No errors** (T1–T6)',
    result.warnings.length ? `\n${result.warnings.map((w) => `- ⚠️ ${w}`).join('\n')}` : '',
    '',
    '<details><summary>Coverage per ID</summary>',
    '',
    '| ID | Status | Tests |',
    '|---|---|---|',
    ...rows,
    '',
    `Planned (T5, not failing): ${planned.join(', ') || 'none'}`,
    '</details>',
  ].join('\n');
}
