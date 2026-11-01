// ID registry for traceability (SPEC.md §3.2, §3.3; AGENTS.md H5). Test titles start with one of these
// IDs; `trace:check` (T4) and the lint rule `nimbus/test-name-has-id` (TECH-10) read the list from here.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Allowed ID prefixes for test titles (AGENTS.md H5). */
export const ID_PREFIXES = ['AC', 'TECH', 'BUG', 'NFR', 'MF', 'RT', 'WS', 'RBAC', 'API', 'TEST', 'MSG', 'HOOK', 'E2E', 'ADR'] as const;
export type IdPrefix = (typeof ID_PREFIXES)[number];

/** `AC-TEN-1.2`, `TECH-5`, `NFR-A11Y-1`, `ADR-0007`, `E2E-15`. */
const ID_SOURCE = `(?:${ID_PREFIXES.join('|')})-(?:[A-Z][A-Z0-9]*-)?\\d+(?:\\.\\d+)?`;
export const ID_PATTERN = new RegExp(`\\b${ID_SOURCE}\\b`, 'g');
const LEADING_ID = new RegExp(`^(${ID_SOURCE}):`);

/** The ID a test title starts with (`"AC-TEN-1.2: …"` → `"AC-TEN-1.2"`), or null. */
export function leadingId(title: string): string | null {
  return LEADING_ID.exec(title.trim())?.[1] ?? null;
}

export type Status = 'planned' | 'in-progress' | 'done';

export interface Registry {
  /** Every defined ID (AC, TECH and the rule families). */
  known: Set<string>;
  /** AC-* and TECH-* with their status and where they're defined. */
  tracked: Map<string, { status: Status; file: string }>;
  retired: Set<string>;
  /** TECH-* → CI job named by its `verify:` line. */
  verify: Map<string, string>;
}

function markdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? markdownFiles(p) : e.name.endsWith('.md') ? [p] : [];
  });
}

/** Reads the specs: AC and TECH tables with statuses, rule definitions, retired IDs, ADR files. */
export function loadRegistry(repo: string): Registry {
  const known = new Set<string>();
  const tracked = new Map<string, { status: Status; file: string }>();
  const verify = new Map<string, string>();
  const rel = (f: string) => path.relative(repo, f);

  const retiredFile = path.join(repo, 'specs/retired-ids.md');
  const retired = new Set<string>();
  if (existsSync(retiredFile)) {
    for (const line of readFileSync(retiredFile, 'utf8').split('\n')) {
      const id = /^\|\s*([A-Z][A-Z0-9.-]+)\s*\|/.exec(line)?.[1];
      if (id && id !== 'Retired ID') retired.add(id);
    }
  }

  const files = [path.join(repo, 'SPEC.md'), ...markdownFiles(path.join(repo, 'specs'))].filter(existsSync);
  for (const file of files) {
    if (file === retiredFile) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      // AC rows: | **AC-TEN-1.2** | criterion | `status` |
      const ac = /^\|\s*\*\*(AC-[A-Z]+-\d+\.\d+)\*\*\s*\|.*\|\s*`(planned|in-progress|done)`\s*\|\s*$/.exec(line);
      if (ac?.[1] && ac[2]) tracked.set(ac[1], { status: ac[2] as Status, file: rel(file) });
      // TECH rows: | TECH-5 | `in-progress` | … `verify: ci/trace-check` |
      const tech = /^\|\s*(TECH-\d+)\s*\|\s*`(planned|in-progress|done)`\s*\|/.exec(line);
      if (tech?.[1] && tech[2]) {
        tracked.set(tech[1], { status: tech[2] as Status, file: rel(file) });
        const job = /`verify:\s*(ci\/[a-z0-9-]+)`/.exec(line)?.[1];
        if (job) verify.set(tech[1], job);
      }
      // Rule definitions: a bold ID anywhere, or an ID in a table row's first cell.
      for (const m of line.matchAll(new RegExp(`\\*\\*(${ID_SOURCE})\\*\\*`, 'g'))) if (m[1]) known.add(m[1]);
      const first = new RegExp(`^\\|\\s*(?:\\*\\*)?(${ID_SOURCE})(?:\\*\\*)?\\s*\\|`).exec(line)?.[1];
      if (first) known.add(first);
    }
  }
  const adrDir = path.join(repo, 'docs/adr');
  if (existsSync(adrDir)) for (const name of readdirSync(adrDir)) {
    const adr = /^(ADR-\d{4})-/.exec(name)?.[1];
    if (adr) known.add(adr);
  }
  for (const id of tracked.keys()) known.add(id);
  for (const id of retired) known.delete(id);
  return { known, tracked, retired, verify };
}
