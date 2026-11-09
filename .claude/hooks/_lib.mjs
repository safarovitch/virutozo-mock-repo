// Shared helpers for Claude Code hooks.
// Contract: hook gets JSON on stdin. Exit 0 = allow. Exit 2 = block; stderr is shown to the agent.
import { readFileSync } from 'node:fs';
import path from 'node:path';

export function readInput() {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

export const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

export function relPath(filePath) {
  if (!filePath) return '';
  const abs = path.isAbsolute(filePath) ? filePath : path.join(projectDir, filePath);
  return path.relative(projectDir, abs).split(path.sep).join('/');
}

export function block(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

export function allow() {
  process.exit(0);
}
