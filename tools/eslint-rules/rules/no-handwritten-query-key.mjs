// @ts-check
// AGENTS.md H13, RT-4: query keys come only from Orval's generated helpers (getXQueryKey), so every area
// patches the same keys the hooks read.
import { propertyName } from './_util.mjs';
const KEY_ARG_METHODS = new Set(['getQueryData', 'setQueryData', 'getQueryState', 'removeQueries', 'ensureQueryData']);
/** @type {import('eslint').Rule.RuleModule} */
export const noHandwrittenQueryKey = {
  meta: {
    type: 'problem',
    docs: { description: "Query keys come from Orval's generated get…QueryKey helpers (AGENTS.md H13)." },
    messages: {
      key: 'Use the generated get…QueryKey() helper from @nimbus/api-client instead of a hand-written key (AGENTS.md H13, RT-4).',
    },
    schema: [],
  },
  create(context) {
    return {
      Property(node) {
        const key = node.key;
        const name = key.type === 'Identifier' ? key.name : key.type === 'Literal' ? key.value : null;
        if ((name === 'queryKey' || name === 'mutationKey') && node.value.type === 'ArrayExpression')
          context.report({ node: node.value, messageId: 'key' });
      },
      CallExpression(node) {
        const method = propertyName(node.callee);
        if (method && KEY_ARG_METHODS.has(method) && node.arguments[0]?.type === 'ArrayExpression')
          context.report({ node: node.arguments[0], messageId: 'key' });
      },
    };
  },
};
