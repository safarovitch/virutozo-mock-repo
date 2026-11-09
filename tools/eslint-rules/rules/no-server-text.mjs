// @ts-check
// AGENTS.md H14, MSG-3: never show `problem.title` or `problem.detail`; show the catalogue message for
// `problem.code` (messageFor).
import { propertyName } from './_util.mjs';
/** `problem`, `error.problem`, `e.problem` … */
function isProblem(node) {
  const n = node;
  if (n.type === 'Identifier') return /problem$/i.test(n.name ?? '');
  return propertyName(node) === 'problem';
}
/** @type {import('eslint').Rule.RuleModule} */
export const noServerText = {
  meta: {
    type: 'problem',
    docs: { description: 'Show the catalogue message for Problem.code, never server text (AGENTS.md H14).' },
    messages: {
      text: 'Show messageFor(problem) (the catalogue text for Problem.code), never problem.{{field}} (AGENTS.md H14, MSG-3).',
    },
    schema: [],
  },
  create(context) {
    return {
      MemberExpression(node) {
        const field = propertyName(node);
        if ((field === 'title' || field === 'detail') && isProblem(node.object))
          context.report({ node, messageId: 'text', data: { field } });
      },
    };
  },
};
