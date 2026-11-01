// `pnpm trace` / CI job ci/trace-check (SPEC.md §3.3, TECH-5, D5-20).
//   node tools/check-trace.ts                      T3–T5 and the AC coverage report
//   node tools/check-trace.ts --pr-body <file>     also T1, T2, T6 against a PR description
// In GitHub Actions the PR description comes from GITHUB_EVENT_PATH. `--summary <file>` writes the
// Markdown report (ci/report posts it on the PR).
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkTrace, formatReport } from './trace/check.ts';
import { loadRegistry } from './trace/ids.ts';

const repo = fileURLToPath(new URL('../', import.meta.url));
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};

function prBody(): string | undefined {
  const file = arg('--pr-body');
  if (file) return readFileSync(file, 'utf8');
  const event = process.env.GITHUB_EVENT_PATH;
  if (event && existsSync(event)) {
    const payload = JSON.parse(readFileSync(event, 'utf8')) as { pull_request?: { body?: string | null } };
    if (payload.pull_request) return payload.pull_request.body ?? '';
  }
  return undefined;
}

const registry = loadRegistry(repo);
const body = prBody();
const result = checkTrace({ repo, registry, ...(body !== undefined ? { prBody: body } : {}) });
const report = formatReport(result, registry);

const summary = arg('--summary');
if (summary) writeFileSync(summary, report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);

const { counts, tests } = result.report;
console.log(`[trace] ${tests} test titles · done ${counts.done} · in progress ${counts['in-progress']} · planned ${counts.planned}${body === undefined ? ' · no PR description (T1/T2/T6 skipped)' : ''}`);
for (const w of result.warnings) console.warn(`[trace] warning: ${w}`);
for (const e of result.errors) console.error(`[trace] ${e}`);
process.exitCode = result.errors.length ? 1 : 0;
