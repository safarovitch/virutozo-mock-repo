// HOOK-3 · AGENTS.md H4 — block changes that weaken tests.
// A human can allow one intentional change by creating .claude/allow-test-change (delete it afterwards).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { readInput, relPath, projectDir, block, allow } from './_lib.mjs';

const input = readInput();
const ti = input.tool_input ?? {};
const file = relPath(ti.file_path);
if (!/\.(test|spec)\.[cm]?[jt]sx?$|\.stories\.[jt]sx?$/.test(file)) allow();
if (existsSync(path.join(projectDir, '.claude/allow-test-change'))) allow();

const abs = path.join(projectDir, file);
let before = '';
let after = '';
if (input.tool_name === 'Write') {
  before = existsSync(abs) ? readFileSync(abs, 'utf8') : '';
  after = ti.content ?? '';
} else if (input.tool_name === 'Edit') {
  before = ti.old_string ?? '';
  after = ti.new_string ?? '';
} else if (input.tool_name === 'MultiEdit') {
  for (const e of ti.edits ?? []) {
    before += `${e.old_string ?? ''}\n`;
    after += `${e.new_string ?? ''}\n`;
  }
}

const count = (s, re) => (s.match(re) ?? []).length;
const expectRe = /\bexpect(\.soft)?\s*\(/g;
const skipRe = /\b(it|test|describe)\s*\.\s*(skip|only|todo|fixme)\b|\bx(it|describe)\s*\(/g;

const problems = [];
const lostExpects = count(before, expectRe) - count(after, expectRe);
if (lostExpects > 0) problems.push(`removes ${lostExpects} expect() assertion(s)`);
if (count(after, skipRe) > count(before, skipRe)) problems.push('adds .skip/.only/.todo/.fixme');
if (/\btoMatchSnapshot\s*\(/.test(after) && !/\btoMatchSnapshot\s*\(/.test(before) && lostExpects > 0) {
  problems.push('replaces assertions with a snapshot');
}

if (problems.length) {
  block(
    `Blocked: this change to ${file} ${problems.join(' and ')} (AGENTS.md H4).\n` +
      'Do not weaken tests to make them pass. Fix the implementation instead.\n' +
      'If you believe the test itself is wrong, stop and explain why to the user. ' +
      'They can allow one change by creating .claude/allow-test-change.',
  );
}
allow();
