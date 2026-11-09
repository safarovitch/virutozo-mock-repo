// @ts-check
// AGENTS.md H7, MF-3: a remote never imports another remote; remotes talk to the shell only through
// @nimbus/mf-contract. The shell loads remotes through Module Federation, never by import either.
// AGENTS.md H7, MF-3: a remote never imports another remote; remotes talk to the shell only through
// @nimbus/mf-contract. The shell loads remotes through Module Federation, never by import either.
import path from 'node:path';
import { repoPath } from './_util.mjs';
const APPS = ['shell', 'tenants', 'storage', 'compute'];
/** The app a specifier points into: `@nimbus/storage…` or a relative path into apps/storage. */
function targetApp(specifier, fromFile) {
  const pkg = /^@nimbus\/([a-z-]+)/.exec(specifier)?.[1];
  if (pkg) return APPS.includes(pkg) ? pkg : null;
  if (!specifier.startsWith('.')) return null;
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
  return /^apps\/([a-z-]+)\//.exec(`${resolved}/`)?.[1] ?? null;
}
/** @type {import('eslint').Rule.RuleModule} */
export const noCrossRemoteImport = {
  meta: {
    type: 'problem',
    docs: { description: 'Apps never import each other; they talk through @nimbus/mf-contract (AGENTS.md H7).' },
    messages: {
      cross:
        '{{from}} must not import from {{to}}: talk to the shell through @nimbus/mf-contract (AGENTS.md H7, MF-3).',
    },
    schema: [],
  },
  create(context) {
    const file = repoPath(context);
    const from = /^apps\/([a-z-]+)\//.exec(file)?.[1];
    if (!from || !APPS.includes(from)) return {};
    const check = (node, source) => {
      if (typeof source !== 'string') return;
      const to = targetApp(source, file);
      if (to && to !== from) context.report({ node, messageId: 'cross', data: { from, to } });
    };
    return {
      ImportDeclaration: (node) => check(node, node.source.value),
      ExportNamedDeclaration: (node) => check(node, node.source?.value),
      ExportAllDeclaration: (node) => check(node, node.source.value),
      ImportExpression: (node) => check(node, node.source.type === 'Literal' ? node.source.value : null),
    };
  },
};
