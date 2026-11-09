// @ts-check
// Eval graders (SPEC.md §11.6, TECH-9). A fixture is a task plus the commit it starts from (`base`); a
// run is the commit an agent produced (`head`). Grading reads both commits with git, so it never touches
// the working tree; `runChecks` also runs typecheck, lint and tests in a temporary worktree at `head`.
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** @typedef {{ name: string; skill: string; task: string; targets: string[]; projects: string[]; ui: boolean; area?: string; base?: string; head?: string }} Fixture */
/** @typedef {{ id: string; pass: boolean; detail: string }} Check */

const git = (/** @type {string} */ repo, /** @type {string[]} */ args) => {
  try {
    return execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    // git grep exits 1 when nothing matches
    if (/** @type {{ status?: number }} */ (error).status === 1) return '';
    throw error;
  }
};

const APP_SRC = /^(apps\/(shell|tenants|storage|compute)|libs\/[^/]+)\/src\/.*\.(ts|tsx|vue)$/;
const TEST_FILE = /\.(test|spec)\.(ts|tsx)$/;
const isAppCode = (f) => APP_SRC.test(f) && !TEST_FILE.test(f) && !/\/testing\/|\.stories\.|^libs\/(api-client|realtime|auth)\//.test(f);

/**
 * What no added line may contain (AGENTS.md hard rules, the §11.6 "forbidden patterns"), each where its
 * rule applies: app rules in app source (not the API client, realtime or RBAC libs, fakes or stories),
 * the Playwright rule in e2e, focused tests in test files.
 */
export const FORBIDDEN = [
  { id: 'H2 raw fetch/axios', re: /(^|[^.\w])fetch\(|\bwindow\.fetch\(|from ['"]axios['"]/, applies: isAppCode },
  { id: 'H3 role check', re: /\.role\s*[!=]==|['"](provider|reseller|tenant)_(admin|viewer)['"]\s*[!=]==/, applies: isAppCode },
  { id: 'H8 raw HTML / web storage', re: /dangerouslySetInnerHTML|v-html|\b(localStorage|sessionStorage)\b/, applies: isAppCode },
  { id: 'H10 Playwright sleep', re: /waitForTimeout\(/, applies: (f) => f.startsWith('apps/e2e/') },
  { id: 'H4 focused or skipped test', re: /\b(it|test|describe)\.(only|skip)\(|\bxit\(/, applies: (f) => TEST_FILE.test(f) },
];

/** Added lines per file between two commits. @returns {Map<string, string[]>} */
export function addedLines(repo, base, head) {
  /** @type {Map<string, string[]>} */
  const files = new Map();
  let current = '';
  for (const line of git(repo, ['diff', '--unified=0', '--no-color', base, head]).split('\n')) {
    if (line.startsWith('+++ ')) current = line.slice(6);
    else if (line.startsWith('+') && current) (files.get(current) ?? files.set(current, []).get(current))?.push(line.slice(1));
  }
  return files;
}

/** @param {string} repo @param {Fixture} fixture @param {string} base @param {string} head @returns {Check[]} */
export function staticChecks(repo, fixture, base, head) {
  /** @type {Check[]} */
  const checks = [];
  const tests = git(repo, ['grep', '-h', '-o', '-E', "(it|test)(\\.[a-z]+)?\\(\\s*['\"`][A-Z]+-[A-Z0-9.-]+:", head, '--', '*.test.ts', '*.test.tsx', '*.spec.ts']);
  const untested = fixture.targets.filter((id) => !new RegExp(`['"\`]${id.replaceAll('.', '\\.')}:`).test(tests));
  checks.push({ id: 'target tests', pass: untested.length === 0, detail: untested.length ? `no test titled ${untested.join(', ')}` : `${fixture.targets.length} IDs have tests` });

  const specs = git(repo, ['grep', '-h', '-E', '\\| \\*\\*(AC|TECH)-', head, '--', 'specs', 'SPEC.md']);
  const notDone = fixture.targets.filter((id) => id.startsWith('AC-') && !new RegExp(`\\*\\*${id.replaceAll('.', '\\.')}\\*\\*.*\`done\``).test(specs));
  checks.push({ id: 'statuses done', pass: notDone.length === 0, detail: notDone.length ? `not done: ${notDone.join(', ')}` : 'every target AC is done' });

  const added = addedLines(repo, base, head);
  const hits = [];
  for (const [file, lines] of added)
    for (const f of FORBIDDEN) {
      if (!f.applies(file)) continue;
      for (const line of lines) if (f.re.test(line) && !/^\s*(\/\/|\*)/.test(line)) hits.push(`${f.id} in ${file}: ${line.trim().slice(0, 80)}`);
    }
  checks.push({ id: 'no forbidden patterns', pass: hits.length === 0, detail: hits.length ? hits.slice(0, 5).join(' | ') : 'none in the added code' });

  const changed = [...added.keys()];
  const generated = changed.filter((f) => f.startsWith('libs/api-client/src/generated/') || f === 'contracts/openapi.yaml');
  const contractFirst = generated.length === 0 || changed.includes('contracts/main.tsp');
  checks.push({ id: 'contract first (H1)', pass: contractFirst, detail: contractFirst ? (generated.length ? 'generated files follow a main.tsp change' : 'no generated files changed') : `generated files changed without main.tsp: ${generated.slice(0, 3).join(', ')}` });

  if (fixture.ui) {
    const stories = git(repo, ['grep', '-h', '-o', '-E', 'export const [A-Za-z]+', head, '--', `apps/${fixture.area}/src/*.stories.*`]);
    const missing = [['loading', /Loading/], ['empty', /Empty/], ['error', /Error/], ['no permission', /NoAccess|NoPermission|ReadOnly/]].filter(([, re]) => !(/** @type {RegExp} */ (re)).test(stories)).map(([name]) => name);
    checks.push({ id: 'five states (H6)', pass: missing.length === 0, detail: missing.length ? `no story for: ${missing.join(', ')}` : 'loading, empty, error and no-permission stories exist' });
  }
  return checks;
}

/** typecheck, lint and test for the fixture's projects, in a throwaway worktree at `head`. @returns {Check} */
export function runChecks(repo, fixture, head) {
  const dir = mkdtempSync(path.join(tmpdir(), `eval-${fixture.name}-`));
  git(repo, ['worktree', 'add', '--detach', dir, head]);
  try {
    execFileSync('pnpm', ['install', '--frozen-lockfile'], { cwd: dir, stdio: 'ignore' });
    execFileSync('pnpm', ['exec', 'nx', 'run-many', '-t', 'typecheck', 'lint', 'test', '-p', ...fixture.projects, '--skip-nx-cache'], { cwd: dir, stdio: 'ignore', env: { ...process.env, NX_DAEMON: 'false' } });
    return { id: 'typecheck, lint, test', pass: true, detail: `passed for ${fixture.projects.join(', ')}` };
  } catch (error) {
    return { id: 'typecheck, lint, test', pass: false, detail: String(/** @type {Error} */ (error).message).split('\n')[0] ?? 'failed' };
  } finally {
    git(repo, ['worktree', 'remove', '--force', dir]);
  }
}

/** @param {Check[]} checks */
export const score = (checks) => Math.round((checks.filter((c) => c.pass).length / checks.length) * 100);
