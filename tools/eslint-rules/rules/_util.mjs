// @ts-check
// Small helpers shared by the nimbus rules. Rules are plain ESLint rules over ESTree nodes, so they work
// for .ts, .tsx and the <script> of .vue files alike.
/** The string value of a literal or a template literal without expressions, else null. */
export function staticString(node) {
  const n = node;
  if (!n) return null;
  if (n.type === 'Literal' && typeof n.value === 'string') return n.value;
  if (n.type === 'TemplateLiteral' && n.expressions?.length === 0) return n.quasis?.[0]?.value.cooked ?? null;
  return null;
}
/** The leading text of a string or template literal (a template's first quasi), else null. */
export function leadingText(node) {
  const n = node;
  if (n?.type === 'TemplateLiteral') return n.quasis?.[0]?.value.cooked ?? null;
  return staticString(node);
}
/** `a.b` → "b" for a non-computed member, or a computed string key. */
export function propertyName(node) {
  const n = node;
  if (n?.type !== 'MemberExpression') return null;
  if (!n.computed && n.property?.type === 'Identifier') return n.property.name ?? null;
  return n.computed ? staticString(n.property) : null;
}
/** The file path with forward slashes, relative to the repo root when it's inside it. */
export function repoPath(context) {
  const file = context.filename.replaceAll('\\', '/');
  const cwd = context.cwd.replaceAll('\\', '/');
  const rootAt = file.search(/\/(apps|libs|tools)\//);
  if (rootAt !== -1) return file.slice(rootAt + 1);
  return file.startsWith(`${cwd}/`) ? file.slice(cwd.length + 1) : file;
}
