// @ts-check
// AGENTS.md H3: permissions come from the generated `Permission` enum, never string literals.
import { staticString } from './_util.mjs';
import { PERMISSIONS } from './sources.mjs';
/** @type {import('eslint').Rule.RuleModule} */
export const noRawPermission = {
  meta: {
    type: 'problem',
    docs: { description: 'Use the generated Permission enum instead of permission strings (AGENTS.md H3).' },
    messages: {
      raw: "Use Permission['{{value}}'] from @nimbus/api-client/model instead of the string '{{value}}' (AGENTS.md H3).",
    },
    schema: [],
  },
  create(context) {
    const check = (node) => {
      const value = staticString(node);
      if (value === null || !PERMISSIONS.has(value)) return;
      // Permission['vm:read'] is the enum itself: the key may be a string.
      const parent = node.parent;
      if (parent.type === 'MemberExpression' && parent.computed && parent.property === node) return;
      context.report({ node, messageId: 'raw', data: { value } });
    };
    return { Literal: check, TemplateLiteral: check };
  },
};
