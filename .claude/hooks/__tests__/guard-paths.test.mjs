// Run: node --test '.claude/hooks/__tests__/*.test.mjs'   (Node ≥ 21 for the glob; no dependencies)
// Black-box: runs the real hook with JSON on stdin and checks the exit code (2 = block, 0 = allow).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('../guard-paths.mjs', import.meta.url));
const projectDir = mkdtempSync(path.join(tmpdir(), 'nimbus-guard-paths-'));

function exitCode(toolInput) {
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: 'Edit', tool_input: toolInput }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
    encoding: 'utf8',
  });
  return res.status;
}

const blocked = {
  'file outside the repo (relative)': '../outside.txt',
  'file outside the repo (absolute)': '/etc/hosts',
  'compiled contract': 'contracts/openapi.yaml',
  'TypeSpec output': 'contracts/tsp-output/@typespec/openapi3/openapi.yaml',
  'generated client': 'libs/api-client/src/generated/react/endpoints.ts',
  '.env at the root': '.env',
  '.env.local in an app': 'apps/mock-api/.env.local',
};

const allowed = {
  'contract source': 'contracts/main.tsp',
  'spec': 'SPEC.md',
  '.env.example': 'apps/mock-api/.env.example',
  'hand-written client code': 'libs/api-client/src/http.ts',
};

for (const [name, file] of Object.entries(blocked)) {
  test(`TECH-7: guard-paths blocks: ${name}`, () => assert.equal(exitCode({ file_path: file }), 2, file));
}
for (const [name, file] of Object.entries(allowed)) {
  test(`TECH-7: guard-paths allows: ${name}`, () => assert.equal(exitCode({ file_path: file }), 0, file));
}
test('TECH-7: guard-paths allows: tool call without a file path', () => assert.equal(exitCode({}), 0));
