// Run: node --test '.claude/hooks/__tests__/*.test.mjs'   (Node ≥ 21 for the glob; no dependencies)
// Black-box: runs the real hook with JSON on stdin and checks the exit code (2 = block, 0 = allow).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
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

// D1-10: the harness itself is protected unless a human creates .claude/allow-harness-change.
function exitCodeIn(dir, toolInput) {
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: 'Edit', tool_input: toolInput }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    encoding: 'utf8',
  });
  return res.status;
}

const harnessFiles = {
  'Claude Code settings': '.claude/settings.json',
  'a hook': '.claude/hooks/guard-bash.mjs',
  'a hook library': '.claude/hooks/guard-bash.lib.mjs',
  'a hook test': '.claude/hooks/__tests__/guard-bash.test.mjs',
};

for (const [name, file] of Object.entries(harnessFiles)) {
  test(`TECH-7: guard-paths blocks: editing ${name} (D1-10)`, () => assert.equal(exitCode({ file_path: file }), 2, file));
}

test('TECH-7: guard-paths allows: editing a hook when .claude/allow-harness-change exists (D1-10)', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'nimbus-guard-paths-allow-'));
  mkdirSync(path.join(dir, '.claude'), { recursive: true });
  writeFileSync(path.join(dir, '.claude/allow-harness-change'), '');
  assert.equal(exitCodeIn(dir, { file_path: '.claude/hooks/guard-bash.mjs' }), 0);
});

test('TECH-7: guard-paths allows: local settings and skills (not protected, D1-10)', () => {
  assert.equal(exitCode({ file_path: '.claude/settings.local.json' }), 0);
  assert.equal(exitCode({ file_path: '.claude/skills/add-wizard/SKILL.md' }), 0);
});
