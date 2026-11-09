// Run: node --test '.claude/hooks/__tests__/*.test.mjs'   (Node ≥ 21 for the glob; no dependencies)
// Black-box: runs the real hook with JSON on stdin and checks the exit code (2 = block, 0 = allow).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('../guard-tests.mjs', import.meta.url));

// Test data is built from parts so this file's own text doesn't look like a skipped test to guard-tests,
// which matches its patterns anywhere in the text, including strings (see the Day 1 spec check, D1-15).
const SKIP = '.sk' + 'ip(';
const ONLY = '.on' + 'ly(';
const XIT = 'x' + 'it(';

function newProject({ allowFile = false, files = {} } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'nimbus-guard-tests-'));
  if (allowFile) {
    mkdirSync(path.join(dir, '.claude'), { recursive: true });
    writeFileSync(path.join(dir, '.claude/allow-test-change'), '');
  }
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), content);
  }
  return dir;
}

function exitCode(toolName, toolInput, projectDir = newProject()) {
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: toolName, tool_input: toolInput }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
    encoding: 'utf8',
  });
  return res.status;
}

const TEST_FILE = 'apps/shell/src/login.test.ts';
const TWO = 'expect(a).toBe(1);\nexpect(b).toBe(2);';
const ONE = 'expect(a).toBe(1);';

test('TECH-7: guard-tests blocks: Edit removes an expect()', () =>
  assert.equal(exitCode('Edit', { file_path: TEST_FILE, old_string: TWO, new_string: ONE }), 2));

test('TECH-7: guard-tests blocks: Edit adds a skip modifier', () =>
  assert.equal(exitCode('Edit', { file_path: TEST_FILE, old_string: "it('x', f)", new_string: `it${SKIP}'x', f)` }), 2));

test('TECH-7: guard-tests blocks: Edit adds an only modifier', () =>
  assert.equal(exitCode('Edit', { file_path: TEST_FILE, old_string: "test('x', f)", new_string: `test${ONLY}'x', f)` }), 2));

test('TECH-7: guard-tests blocks: Edit switches it() to its x-prefixed skip form', () =>
  assert.equal(exitCode('Edit', { file_path: TEST_FILE, old_string: "it('x', f)", new_string: `${XIT}'x', f)` }), 2));

test('TECH-7: guard-tests blocks: MultiEdit removes an expect()', () =>
  assert.equal(exitCode('MultiEdit', { file_path: TEST_FILE, edits: [{ old_string: TWO, new_string: ONE }] }), 2));

test('TECH-7: guard-tests blocks: Write overwrites a test file with fewer expects', () => {
  const dir = newProject({ files: { [TEST_FILE]: TWO } });
  assert.equal(exitCode('Write', { file_path: TEST_FILE, content: ONE }, dir), 2);
});

test('TECH-7: guard-tests blocks: removing an expect() in a story', () =>
  assert.equal(exitCode('Edit', { file_path: 'libs/ui-kit/src/Button.stories.tsx', old_string: TWO, new_string: ONE }), 2));

test('TECH-7: guard-tests blocks: removing an expect() in a .test.mjs hook test', () =>
  assert.equal(exitCode('Edit', { file_path: '.claude/hooks/__tests__/x.test.mjs', old_string: TWO, new_string: ONE }), 2));

test('TECH-7: guard-tests allows: Edit adds an expect()', () =>
  assert.equal(exitCode('Edit', { file_path: TEST_FILE, old_string: ONE, new_string: TWO }), 0));

test('TECH-7: guard-tests allows: Edit renames a test without touching assertions', () =>
  assert.equal(exitCode('Edit', { file_path: TEST_FILE, old_string: "it('old name', f)", new_string: "it('AC-SHL-1.1: new name', f)" }), 0));

test('TECH-7: guard-tests allows: removing an expect() from a non-test file', () =>
  assert.equal(exitCode('Edit', { file_path: 'apps/shell/src/login.ts', old_string: TWO, new_string: ONE }), 0));

test('TECH-7: guard-tests allows: Write creates a new test file', () =>
  assert.equal(exitCode('Write', { file_path: TEST_FILE, content: TWO }), 0));

test('TECH-7: guard-tests allows: a weakening change when .claude/allow-test-change exists', () => {
  const dir = newProject({ allowFile: true });
  assert.equal(exitCode('Edit', { file_path: TEST_FILE, old_string: TWO, new_string: ONE }, dir), 0);
});

// D1-15: patterns inside strings and comments are data, not code.
test('TECH-7: guard-tests allows: a test title that mentions xit() (D1-15)', () =>
  assert.equal(exitCode('Edit', { file_path: TEST_FILE, old_string: "it('a', f)", new_string: "it('turns it() into xit() and it.skip()', f)" }), 0));

test('TECH-7: guard-tests allows: a comment that mentions a skip modifier (D1-15)', () =>
  assert.equal(exitCode('Edit', { file_path: TEST_FILE, old_string: "it('a', f)", new_string: `// never use it${SKIP}) here\nit('a', f)` }), 0));

test('TECH-7: guard-tests blocks: a real skip next to a string that mentions one (D1-15)', () =>
  assert.equal(exitCode('Edit', { file_path: TEST_FILE, old_string: "it('a', f)", new_string: `it${SKIP}'mentions xit()', f)` }), 2));

// D1-18: any newly added snapshot assertion is blocked unless .claude/allow-test-change exists.
const SNAP = '.toMatch' + 'Snapshot()';
const INLINE_SNAP = '.toMatchInline' + 'Snapshot()';

test('TECH-7: guard-tests blocks: swapping an assertion for a snapshot (D1-18)', () =>
  assert.equal(exitCode('Edit', { file_path: TEST_FILE, old_string: 'expect(x).toEqual(y);', new_string: `expect(x)${SNAP};` }), 2));

test('TECH-7: guard-tests blocks: adding an inline snapshot (D1-18)', () =>
  assert.equal(exitCode('Edit', { file_path: TEST_FILE, old_string: 'expect(x).toEqual(y);', new_string: `expect(x).toEqual(y);\nexpect(z)${INLINE_SNAP};` }), 2));

test('TECH-7: guard-tests allows: an edit that keeps an existing snapshot (D1-18)', () =>
  assert.equal(exitCode('Edit', { file_path: TEST_FILE, old_string: `expect(x)${SNAP};`, new_string: `// renamed\nexpect(x)${SNAP};` }), 0));

test('TECH-7: guard-tests allows: a new snapshot when .claude/allow-test-change exists (D1-18)', () => {
  const dir = newProject({ allowFile: true });
  assert.equal(exitCode('Edit', { file_path: TEST_FILE, old_string: 'expect(x).toEqual(y);', new_string: `expect(x)${SNAP};` }, dir), 0);
});
