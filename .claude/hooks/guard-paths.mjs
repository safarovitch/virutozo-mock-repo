// HOOK-2 · AGENTS.md H1, H8 — block edits to generated files, secrets, the harness, and files outside the repo.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { readInput, relPath, projectDir, block, allow } from './_lib.mjs';

const input = readInput();
const file = relPath(input.tool_input?.file_path);
if (!file) allow();

if (file.startsWith('..')) {
  block(`Blocked: ${file} is outside the repository. Only edit files inside the repo.`);
}

const generated = [
  /^contracts\/openapi\.yaml$/,
  /^contracts\/tsp-output\//,
  /^libs\/api-client\/src\/generated\//,
];
if (generated.some((re) => re.test(file))) {
  block(
    `Blocked: ${file} is generated (AGENTS.md H1).\n` +
      'Change contracts/main.tsp instead, then run: pnpm contract:build && pnpm api:generate',
  );
}

if (/^\.env(\..*)?$/.test(file.split('/').pop() ?? '') && !file.endsWith('.env.example')) {
  block(`Blocked: ${file} may contain secrets. Edit .env.example instead.`);
}

// D1-10: the harness can't switch itself off. Only a human creates .claude/allow-harness-change.
const harness = [/^\.claude\/settings\.json$/, /^\.claude\/hooks\//];
if (harness.some((re) => re.test(file)) && !existsSync(path.join(projectDir, '.claude/allow-harness-change'))) {
  block(
    `Blocked: ${file} is part of the agent harness (AGENTS.md H15).\n` +
      'Agents may not change hooks or settings. Ask the user; they can allow one change by creating .claude/allow-harness-change.',
  );
}

allow();
