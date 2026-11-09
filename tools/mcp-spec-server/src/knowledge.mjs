// @ts-check
// The product knowledge base behind the MCP spec server (SPEC.md §11.5, TECH-8). Pure functions over the
// repo's files: SPEC.md and specs/ (requirements, ACs, RBAC), contracts/openapi.yaml (operations) and the
// test files (coverage). Plain .mjs so it runs on whatever Node the MCP client starts (D9-02).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

/** @typedef {{ id: string; kind: string; text: string; status?: string; file: string; parents: string[]; children: string[] }} Requirement */

const ID = /\b(?:REQ|US|SPEC|AC|TECH|NFR|RT|MF|WS|RBAC|API|TEST|MSG|HOOK|E2E|BUG|ADR)-[A-Z0-9]+(?:-[A-Z0-9]+)*(?:\.\d+)?\b/g;
const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-e2e', '.git', '.nx', 'coverage', 'test-results', 'playwright-report', 'storybook-static', 'tsp-output']);
const TEST_FILE = /\.(test|spec)\.(ts|tsx|mts|mjs)$/;

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (SKIP_DIRS.has(e.name)) return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

const cells = (/** @type {string} */ line) => line.split('|').slice(1, -1).map((c) => c.trim());
const plain = (/** @type {string} */ s) => s.replaceAll('**', '').replaceAll('`', '');

/**
 * Loads the repo once. Tools are cheap lookups afterwards; call again to pick up edits.
 * @param {string} repo absolute path of the repository root
 */
export function loadKnowledge(repo) {
  const rel = (/** @type {string} */ f) => path.relative(repo, f);
  const markdown = [path.join(repo, 'SPEC.md'), ...walk(path.join(repo, 'specs')).filter((f) => f.endsWith('.md'))].filter(existsSync);
  /** @type {Map<string, Requirement>} */
  const items = new Map();
  /** @type {{ file: string; heading: string; text: string }[]} */
  const sections = [];

  for (const file of markdown) {
    const text = readFileSync(file, 'utf8');
    const front = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? '';
    const specId = /^id:\s*(SPEC-[A-Z]+-\d+)/m.exec(front)?.[1];
    if (specId) {
      const title = /^title:\s*"?(.*?)"?$/m.exec(front)?.[1] ?? '';
      const implementsLine = /\*\*Implements:\*\*\s*(.*)$/m.exec(text)?.[1] ?? '';
      const behaviour = /\*\*Behaviour:?\*\*:?\s*([\s\S]*?)\n\n\*\*Acceptance/.exec(text)?.[1]?.trim() ?? '';
      const acs = [...text.matchAll(/^\|\s*\*\*(AC-[A-Z]+-\d+\.\d+)\*\*/gm)].map((m) => /** @type {string} */ (m[1]));
      items.set(specId, { id: specId, kind: 'spec', text: plain(`${title}. ${behaviour}`), file: rel(file), parents: [...new Set(implementsLine.match(ID) ?? [])], children: acs });
    }
    for (const line of text.split('\n')) {
      if (!line.startsWith('|')) continue;
      const row = cells(line);
      const id = /^\*{0,2}([A-Z]+-[A-Z0-9.-]+?)\*{0,2}$/.exec(row[0] ?? '')?.[1];
      if (!id || !/^(REQ|US|AC|TECH|BUG|E2E|RT|WS|MF|NFR|RBAC|API|TEST|MSG|HOOK|ADR)-[A-Z0-9]/.test(id) || items.has(id)) continue;
      const status = /`(planned|in-progress|done)`/.exec(line)?.[1];
      const kind = id.split('-')[0]?.toLowerCase() ?? 'other';
      /** @type {string[]} */
      let parents = [];
      if (kind === 'ac' && specId) parents = [specId];
      if (kind === 'us') parents = (row.at(-1) ?? '').match(ID) ?? [];
      items.set(id, { id, kind, text: plain(row.slice(1, status ? -1 : undefined).filter((c) => c && !/^`?(MVP|planned|in-progress|done)`?$/.test(c)).join(' — ')), ...(status ? { status } : {}), file: rel(file), parents, children: [] });
    }
    // Rule definitions written as a bold ID in a list item or paragraph (RT-1, NFR-SEC-3, MF-2 …).
    for (const m of text.matchAll(/^\s*[-*]?\s*\*\*([A-Z]+-[A-Z0-9-]+?(?:\.\d+)?)\*\*\s*(.+)$/gm)) {
      const id = /** @type {string} */ (m[1]);
      if (!items.has(id)) items.set(id, { id, kind: id.split('-')[0]?.toLowerCase() ?? 'other', text: plain(/** @type {string} */ (m[2])), file: rel(file), parents: [], children: [] });
    }
    let heading = rel(file);
    let body = [];
    for (const line of text.split('\n')) {
      if (/^#{1,4} /.test(line)) {
        if (body.length) sections.push({ file: rel(file), heading, text: body.join('\n') });
        heading = line.replace(/^#+ /, '');
        body = [];
      } else body.push(line);
    }
    if (body.length) sections.push({ file: rel(file), heading, text: body.join('\n') });
  }

  // Children: US under REQ, SPEC under US/REQ.
  for (const item of items.values())
    for (const parent of item.parents) {
      const p = items.get(parent);
      if (p && !p.children.includes(item.id)) p.children.push(item.id);
    }

  const openapi = existsSync(path.join(repo, 'contracts/openapi.yaml')) ? parseYaml(readFileSync(path.join(repo, 'contracts/openapi.yaml'), 'utf8')) : { paths: {} };
  const rbac = existsSync(path.join(repo, 'specs/shared/rbac.md')) ? readFileSync(path.join(repo, 'specs/shared/rbac.md'), 'utf8') : '';
  const tests = walk(repo).filter((f) => TEST_FILE.test(f) && !f.includes(`${path.sep}.claude${path.sep}`));

  return { repo, items, sections, openapi, rbac, tests: tests.map((f) => ({ file: rel(f), text: readFileSync(f, 'utf8') })) };
}

/** @typedef {ReturnType<typeof loadKnowledge>} Knowledge */

/** `get_requirement`: the text plus parent and child IDs. @param {Knowledge} k @param {string} id */
export function getRequirement(k, id) {
  const item = k.items.get(id.trim());
  if (!item) return { found: false, id, hint: 'Unknown ID. Try search_specs with words from the requirement.' };
  return { found: true, ...item };
}

/** `search_specs`: sections whose text contains every word, best first (word hits), at most 10. @param {Knowledge} k @param {string} query */
export function searchSpecs(k, query) {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return [];
  return k.sections
    .map((s) => {
      const hay = `${s.heading}\n${s.text}`.toLowerCase();
      const hits = words.map((w) => hay.split(w).length - 1);
      return { s, score: hits.every((h) => h > 0) ? hits.reduce((a, b) => a + b, 0) : 0 };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(({ s }) => {
      const at = s.text.toLowerCase().indexOf(/** @type {string} */ (words[0]));
      return { file: s.file, heading: s.heading, ids: [...new Set(`${s.heading} ${s.text}`.match(ID) ?? [])].slice(0, 20), snippet: plain(s.text.slice(Math.max(0, at - 120), at + 280)).replace(/\s+/g, ' ').trim() };
    });
}

/** `get_operation`: method, path, permission, parameters, schemas and error responses. @param {Knowledge} k @param {string} operationId */
export function getOperation(k, operationId) {
  for (const [route, methods] of Object.entries(k.openapi.paths ?? {}))
    for (const [method, op] of Object.entries(/** @type {Record<string, any>} */ (methods))) {
      if (op?.operationId !== operationId) continue;
      const responses = Object.entries(op.responses ?? {}).map(([status, r]) => ({
        status,
        description: /** @type {any} */ (r).description,
        schema: Object.values(/** @type {any} */ (r).content ?? {})[0]?.schema ?? null,
      }));
      return {
        found: true,
        operationId,
        method: method.toUpperCase(),
        path: `/api${route}`,
        summary: op.summary ?? '',
        description: op.description ?? '',
        permission: op['x-permission'] ?? null,
        parameters: op.parameters ?? [],
        requestBody: Object.values(op.requestBody?.content ?? {})[0]?.schema ?? null,
        responses,
        errorStatuses: responses.map((r) => r.status).filter((s) => Number(s) >= 400),
      };
    }
  return { found: false, operationId, hint: `Known operations: ${Object.values(k.openapi.paths ?? {}).flatMap((m) => Object.values(/** @type {Record<string, any>} */ (m)).map((o) => o?.operationId)).filter(Boolean).join(', ')}` };
}

/** `get_permissions`: RBAC matrix rows for a role (its permissions) or a permission (who has it). @param {Knowledge} k @param {string} roleOrPermission */
export function getPermissions(k, roleOrPermission) {
  const lines = k.rbac.split('\n').filter((l) => l.startsWith('|'));
  const header = cells(lines.find((l) => /\|\s*Permission\s*\|/.test(l)) ?? '');
  const roles = header.slice(1);
  const rows = lines
    .map(cells)
    .filter((r) => /^[a-z]+:[a-z]+/.test(r[0] ?? ''))
    .flatMap((r) => {
      // "bucket:create / delete" is two permissions.
      const [first, ...more] = (r[0] ?? '').split('/').map((p) => p.trim());
      const resource = first?.split(':')[0];
      const names = [first, ...more.map((a) => `${resource}:${a}`)];
      return names.map((permission) => ({ permission, roles: Object.fromEntries(roles.map((role, i) => [role, r[i + 1] ?? ''])) }));
    });
  const q = roleOrPermission.trim();
  if (roles.includes(q)) return { role: q, permissions: rows.filter((r) => /✅/.test(r.roles[q] ?? '')).map((r) => ({ permission: r.permission, scope: (r.roles[q] ?? '').replace('✅', '').trim() || 'all' })) };
  const row = rows.find((r) => r.permission === q);
  if (row) return { permission: q, roles: row.roles };
  return { found: false, query: q, roles, permissions: rows.map((r) => r.permission) };
}

/** `coverage_for`: the tests titled with an AC ID, its status, and the last CI status (D9-10). @param {Knowledge} k @param {string} acId */
export function coverageFor(k, acId) {
  const id = acId.trim();
  const escaped = id.replace(/[.]/g, '\\.');
  const title = new RegExp(`\\b(?:it|test|xit)(?:\\.\\w+)?\\(\\s*['"\`](${escaped}:[^'"\`]*)`, 'g');
  const tests = k.tests.flatMap((t) => [...t.text.matchAll(title)].map((m) => ({ file: t.file, line: t.text.slice(0, m.index).split('\n').length, title: m[1] ?? '' })));
  const item = k.items.get(id);
  return { id, status: item?.status ?? null, spec: item?.parents[0] ?? null, tests, lastCiStatus: 'unknown' };
}
