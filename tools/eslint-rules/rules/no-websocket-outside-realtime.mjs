// @ts-check
// AGENTS.md H13, RT-1: only libs/realtime opens a WebSocket; everyone else gets `server:*` from the bus.
/** @type {import('eslint').Rule.RuleModule} */
export const noWebsocketOutsideRealtime = {
  meta: {
    type: 'problem',
    docs: { description: 'Only libs/realtime opens a WebSocket (AGENTS.md H13).' },
    messages: {
      socket:
        'Subscribe to server:* events on your bus scope; only libs/realtime opens a WebSocket (AGENTS.md H13, RT-1).',
    },
    schema: [],
  },
  create(context) {
    return {
      NewExpression(node) {
        const callee = node.callee;
        const name =
          callee.type === 'Identifier'
            ? callee.name
            : callee.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier'
              ? callee.property.name
              : null;
        if (name === 'WebSocket' || name === 'EventSource') context.report({ node, messageId: 'socket' });
      },
    };
  },
};
