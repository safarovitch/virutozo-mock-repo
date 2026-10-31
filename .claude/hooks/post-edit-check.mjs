// HOOK-1 — after each edit, typecheck + lint the Nx project that owns the file and feed errors back.
// Exit 2 on PostToolUse shows stderr to the agent (the edit itself is already applied).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { readInput, relPath, projectDir, allow } from './_lib.mjs';

const file = relPath(readInput().tool_input?.file_path);
const m = file.match(/^(apps|libs|tools)\/([\w.-]+)\//);
if (!m || !/\.(ts|tsx|vue|mts|cts|js|jsx|mjs)$/.test(file)) allow();

const projectRoot = path.join(projectDir, m[1], m[2]);
if (!existsSync(path.join(projectRoot, 'project.json')) && !existsSync(path.join(projectRoot, 'package.json'))) allow();
if (!existsSync(path.join(projectDir, 'node_modules/.bin/nx'))) allow(); // workspace not installed yet

const project = m[2];
const res = spawnSync(
  'pnpm',
  ['exec', 'nx', 'run-many', '-t', 'typecheck', 'lint', '-p', project, '--outputStyle=static', '--skipNxCache'],
  { cwd: projectDir, encoding: 'utf8', timeout: 170_000 },
);
if (res.status === 0) allow();

const out = `${res.stdout ?? ''}\n${res.stderr ?? ''}`
  .split('\n')
  .filter((l) => /error|warning|✖|TS\d{4}/i.test(l))
  .slice(0, 60)
  .join('\n');
process.stderr.write(
  `Checks failed for project "${project}" after editing ${file}. Fix these before continuing:\n${out || res.stdout?.slice(-3000)}\n`,
);
process.exit(2);
