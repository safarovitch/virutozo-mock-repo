// HOOK-2 · AGENTS.md H1, H8 — block edits to generated files and files outside the repo.
import { readInput, relPath, block, allow } from './_lib.mjs';

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

allow();
