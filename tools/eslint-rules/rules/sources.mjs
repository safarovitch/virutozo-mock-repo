// @ts-check
// Lists the rules share with other tools, read from their TypeScript sources as text, so the plugin runs
// on any Node the hooks use (HOOK-1 runs ESLint with the shell's default Node, which may lack type
// stripping). Each list stays defined once: tools/trace/ids.ts and Orval's generated Permission.
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');

/** `ID_PREFIXES` from tools/trace/ids.ts (AGENTS.md H5). */
export const ID_PREFIXES = /** @type {string[]} */ (
  [
    ...(/export const ID_PREFIXES = \[([^\]]+)\]/.exec(read('../../trace/ids.ts'))?.[1] ?? '').matchAll(
      /'([A-Z0-9]+)'/g,
    ),
  ].map((m) => m[1])
);
if (ID_PREFIXES.length === 0) throw new Error('eslint-rules: no ID_PREFIXES found in tools/trace/ids.ts');

/** The contract's permission strings, from the generated `Permission` constant. */
export const PERMISSIONS = new Set(
  [
    ...read('../../../libs/api-client/src/generated/model/permission.ts').matchAll(/^\s*'([a-z]+:[a-z]+)': '\1',?$/gm),
  ].map((m) => m[1]),
);
if (PERMISSIONS.size === 0) throw new Error('eslint-rules: no permissions found in the generated Permission model');

const ID_SOURCE = `(?:${ID_PREFIXES.join('|')})-(?:[A-Z][A-Z0-9]*-)?\\d+(?:\\.\\d+)?`;
const LEADING_ID = new RegExp(`^(${ID_SOURCE}):`);

/** The same check as `leadingId` in tools/trace/ids.ts. */
export const leadingId = (title) => LEADING_ID.exec(title.trim())?.[1] ?? null;
