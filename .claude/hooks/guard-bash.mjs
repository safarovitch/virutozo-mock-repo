// HOOK-5 · AGENTS.md H12 — block destructive shell commands.
// v2: rules are matched against the *executed* parts of the command only.
//   - heredoc bodies are data (removed), unless the heredoc feeds a shell (`bash <<EOF`)
//   - quoted strings are data (removed), except $(…) / `…` inside double quotes, which execute
//   - arguments of `bash -c`, `sh -c`, `zsh -c` and `eval` execute, so they're checked recursively
import { readInput, block, allow } from './_lib.mjs';

const SHELL_RE = /\b(?:ba|z|da)?sh\b/;

/** Remove heredoc bodies; return [commandText, bodiesThatExecute]. */
export function stripHeredocs(cmd) {
  const lines = cmd.split('\n');
  const out = [];
  const executed = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    out.push(line);
    const re = /<<-?\s*(['"]?)([A-Za-z_][\w-]*)\1/g;
    let m;
    const pending = [];
    while ((m = re.exec(line))) pending.push({ delim: m[2], feedsShell: SHELL_RE.test(line.slice(0, m.index)) });
    for (const { delim, feedsShell } of pending) {
      const body = [];
      while (i + 1 < lines.length && lines[i + 1].trim() !== delim) body.push(lines[++i]);
      if (i + 1 < lines.length) i++; // skip delimiter line
      if (feedsShell) executed.push(body.join('\n'));
    }
  }
  return [out.join('\n'), executed];
}

/** Remove quoted data; return [unquotedText, substitutionsThatExecute]. */
export function stripQuotes(cmd) {
  let out = '';
  const executed = [];
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (c === '\\') { out += cmd.slice(i, i + 2); i++; continue; }
    if (c === "'") {
      const end = cmd.indexOf("'", i + 1);
      i = end === -1 ? cmd.length : end;
      out += "''";
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      while (j < cmd.length && cmd[j] !== '"') {
        if (cmd[j] === '\\') { j += 2; continue; }
        if (cmd[j] === '$' && cmd[j + 1] === '(') {
          let depth = 1, k = j + 2;
          while (k < cmd.length && depth) { if (cmd[k] === '(') depth++; else if (cmd[k] === ')') depth--; k++; }
          executed.push(cmd.slice(j + 2, k - 1));
          j = k; continue;
        }
        if (cmd[j] === '`') {
          const k = cmd.indexOf('`', j + 1);
          executed.push(cmd.slice(j + 1, k === -1 ? cmd.length : k));
          j = k === -1 ? cmd.length : k + 1; continue;
        }
        j++;
      }
      i = j;
      out += '""';
      continue;
    }
    out += c;
  }
  return [out, executed];
}

/** Arguments passed to `sh -c` / `bash -c` / `eval`, which execute. */
export function shellCArgs(cmd) {
  const found = [];
  const re = /(?:\b(?:ba|z|da)?sh\s+(?:-\w*\s+)*-c|\beval)\s+(?:'([^']*)'|"((?:[^"\\]|\\.)*)"|(\S+))/g;
  let m;
  while ((m = re.exec(cmd))) found.push(m[1] ?? m[2] ?? m[3] ?? '');
  return found;
}

const RULES = [
  [/\bgit\s+push\b[^\n;&|]*(?:--force\b|--force-with-lease\b|\s-f\b)/, 'force push'],
  [/\bgit\s+reset\s+--hard\b/, 'git reset --hard'],
  [/\bgit\s+clean\s+-[a-z]*f/, 'git clean -f'],
  [/\bgit\s+checkout\s+--\s+\./, 'discarding all local changes'],
  [/(?:^|[;&|(\s])sudo\s/, 'sudo'],
  [/\b(?:curl|wget)\b[^|\n]*\|\s*(?:ba|z)?sh\b/, 'piping a download into a shell'],
  [/\b(?:npm|pnpm|yarn)\s+(?:publish|unpublish)\b/, 'publishing packages'],
];

const SAFE_RM_TARGET =
  /^(?:\.\/)?(?:(?:apps|libs|tools)\/[\w.-]+\/|contracts\/)?(?:dist|tmp|coverage|node_modules|\.nx|storybook-static|test-results|playwright-report|tsp-output)(?:\/.*)?$/;

/** Returns a reason string if `cmd` would execute something forbidden, else null. */
export function check(cmd, depth = 0) {
  if (depth > 3) return null;
  const [noHeredoc, heredocExec] = stripHeredocs(cmd);
  const nested = [...heredocExec, ...shellCArgs(noHeredoc)];
  const [code, substitutions] = stripQuotes(noHeredoc);
  nested.push(...substitutions);

  for (const [re, what] of RULES) if (re.test(code)) return what;

  for (const segment of code.split(/;|&&|\|\||\||\n|\$\(|`/)) {
    const m = segment.match(/(?:^|\s)rm\s+((?:-[a-zA-Z]+\s+|--[a-z-]+\s+)*)(.*)$/);
    if (!m) continue;
    const flags = m[1].replace(/\s+/g, '');
    const recursive = /-[a-zA-Z]*[rR]/.test(flags) || flags.includes('--recursive');
    const force = /-[a-zA-Z]*f/.test(flags) || flags.includes('--force');
    if (!(recursive && force)) continue;
    const targets = m[2].trim().split(/\s+/).filter(Boolean);
    const bad = targets.filter((t) => t.split('/').includes('..') || !SAFE_RM_TARGET.test(t));
    if (bad.length || targets.length === 0) return `rm -rf on ${bad.join(', ') || '(no target)'}`;
  }

  for (const inner of nested) {
    const reason = check(inner, depth + 1);
    if (reason) return reason;
  }
  return null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const reason = check(String(readInput().tool_input?.command ?? ''));
  if (reason) {
    block(`Blocked: ${reason} is not allowed (AGENTS.md H12). Only build/cache folders may be force-deleted. Ask the user if it's really needed.`);
  }
  allow();
}
