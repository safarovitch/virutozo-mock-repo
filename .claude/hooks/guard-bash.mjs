// HOOK-5 · AGENTS.md H12 — block destructive shell commands.
// The logic lives in guard-bash.lib.mjs. This file always runs the check: there is no
// `import.meta.url === argv[1]` guard, which failed open when called through a symlink (D1-16).
import { readInput, block, allow } from './_lib.mjs';
import { check } from './guard-bash.lib.mjs';

const reason = check(String(readInput().tool_input?.command ?? ''));
if (reason) {
  block(`Blocked: ${reason} is not allowed (AGENTS.md H12). Only build/cache folders may be force-deleted. Ask the user if it's really needed.`);
}
allow();
