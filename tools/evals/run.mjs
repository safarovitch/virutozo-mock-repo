// @ts-check
// `pnpm eval <fixture> [--head <commit>] [--checks]`: grades one fixture and records the result in
// tools/evals/results/ (a JSON file per run and the score table in results/README.md). A skill change
// must not lower its fixtures' scores (SPEC.md §11.6).
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runChecks, score, staticChecks } from './grade.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const [name, ...rest] = process.argv.slice(2);
const flag = (f) => rest.includes(f);
const opt = (f) => (rest.includes(f) ? rest[rest.indexOf(f) + 1] : undefined);
if (!name) {
  console.error('usage: pnpm eval <fixture> [--head <commit>] [--checks]');
  process.exit(2);
}

/** @type {import('./grade.mjs').Fixture} */
const fixture = JSON.parse(readFileSync(path.join(HERE, 'fixtures', name, 'fixture.json'), 'utf8'));
const base = fixture.base;
const head = opt('--head') ?? fixture.head;
if (!base || !head) {
  console.error(`${name}: needs a base and a head commit (an agent's run); none recorded yet`);
  process.exit(2);
}
const rev = (r) => execFileSync('git', ['rev-parse', '--short', r], { cwd: REPO, encoding: 'utf8' }).trim();

// The skill version is the hash of SKILL.md at `head`; a head that predates the skill is a baseline.
let skillVersion = 'none (baseline)';
try {
  const text = execFileSync('git', ['show', `${head}:.claude/skills/${fixture.skill}/SKILL.md`], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  skillVersion = createHash('sha256').update(text).digest('hex').slice(0, 8);
} catch {
  // not in that commit
}

const checks = [...staticChecks(REPO, fixture, base, head), ...(flag('--checks') ? [runChecks(REPO, fixture, head)] : [])];
const result = { fixture: name, skill: fixture.skill, skillVersion, base: rev(base), head: rev(head), date: new Date().toISOString().slice(0, 10), score: score(checks), checks };
writeFileSync(path.join(HERE, 'results', `${name}.json`), `${JSON.stringify(result, null, 2)}\n`);

const table = path.join(HERE, 'results', 'README.md');
const header = '# Eval results\n\nOne row per graded run (SPEC.md §11.6). `skillVersion` is the hash of the skill at the graded commit; "baseline" means the work was done before the skill existed. A skill change must not lower a fixture\'s score.\n\n| Date | Fixture | Skill | Skill version | Base → head | Score | Failed checks |\n|---|---|---|---|---|---|---|\n';
const rows = existsSync(table) ? readFileSync(table, 'utf8').split('\n').filter((l) => l.startsWith('| 2')) : [];
const failed = checks.filter((c) => !c.pass).map((c) => c.id).join(', ') || '—';
rows.push(`| ${result.date} | ${name} | ${fixture.skill} | ${skillVersion} | ${result.base} → ${result.head} | ${result.score}% | ${failed} |`);
writeFileSync(table, `${header}${rows.join('\n')}\n`);
console.log(`${name}: ${result.score}%`);
for (const c of checks) console.log(`  ${c.pass ? '✓' : '✗'} ${c.id}: ${c.detail}`);
