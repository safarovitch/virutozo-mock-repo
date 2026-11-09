// @ts-check
// AGENTS.md H5, TEST-1: every test title starts with a known ID prefix (tools/trace/ids.ts). trace:check
// (T4) also checks that the ID exists; the lint rule gives the same feedback while typing.
import { ID_PREFIXES, leadingId } from './sources.mjs';
import { leadingText } from './_util.mjs';
const TEST_FNS = new Set(['it', 'test', 'xit']);
const PARTIAL_ID = new RegExp(`^(?:${ID_PREFIXES.join('|')})-[A-Z0-9.-]*$`);
function testCallee(callee) {
  const c = callee;
  if (c.type === 'Identifier') return TEST_FNS.has(c.name ?? '');
  // it.skip / test.only / test.fixme … (but not test.describe, test.step, test.use)
  if (c.type === 'MemberExpression' && !c.computed) {
    const object = c.object;
    const property = callee.property.name ?? '';
    return (
      object.type === 'Identifier' &&
      TEST_FNS.has(object.name ?? '') &&
      ['only', 'skip', 'todo', 'fixme', 'fails', 'concurrent'].includes(property)
    );
  }
  return false;
}
/** @type {import('eslint').Rule.RuleModule} */
export const testNameHasId = {
  meta: {
    type: 'problem',
    docs: { description: 'Test titles start with a known ID (AGENTS.md H5).' },
    messages: {
      missing:
        'Start the test title with an ID and a colon, e.g. "AC-TEN-2.4: …". Allowed prefixes: {{prefixes}} (AGENTS.md H5).',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!testCallee(node.callee)) return;
        const title = node.arguments[0];
        const text = leadingText(title);
        if (text === null) return; // a variable title (story smoke tests build theirs from the story name)
        // A template's first part may end before the ID's colon: `${id}: …` and `AC-TEN-${n}: …` can't be
        // judged here (trace:check reads the real titles); `renders ${name}` can.
        const partial = title?.type === 'TemplateLiteral' && title.expressions.length > 0 && !text.includes(':');
        if (partial && (text === '' || PARTIAL_ID.test(text))) return;
        if (leadingId(text)) return;
        context.report({ node: title ?? node, messageId: 'missing', data: { prefixes: ID_PREFIXES.join(' ') } });
      },
    };
  },
};
