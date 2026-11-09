// @ts-check
// AGENTS.md H2: app code calls the API through @nimbus/api-client, never fetch/axios directly.
const GLOBALS = new Set(['window', 'globalThis', 'self']);
/** @type {import('eslint').Rule.RuleModule} */
export const noDirectFetch = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Use the generated clients from @nimbus/api-client instead of fetch or axios (AGENTS.md H2).',
    },
    messages: {
      fetch: 'Call the API through @nimbus/api-client (generated hooks or clients), not fetch (AGENTS.md H2).',
      axios: 'Call the API through @nimbus/api-client, not axios (AGENTS.md H2).',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type === 'Identifier' && callee.name === 'fetch') context.report({ node, messageId: 'fetch' });
        else if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'fetch' &&
          callee.object.type === 'Identifier' &&
          GLOBALS.has(callee.object.name)
        )
          context.report({ node, messageId: 'fetch' });
      },
      ImportDeclaration(node) {
        if (node.source.value === 'axios') context.report({ node, messageId: 'axios' });
      },
    };
  },
};
