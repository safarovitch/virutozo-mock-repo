// @ts-check
// AGENTS.md H10: Playwright waits on conditions (web-first assertions), never on time.
import { propertyName } from './_util.mjs';
/** @type {import('eslint').Rule.RuleModule} */
export const noPlaywrightSleep = {
  meta: {
    type: 'problem',
    docs: { description: 'No waitForTimeout in Playwright tests (AGENTS.md H10).' },
    messages: {
      sleep: 'Wait for a condition (expect(…).toBeVisible(), expect.poll) instead of waitForTimeout (AGENTS.md H10).',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (propertyName(node.callee) === 'waitForTimeout') context.report({ node, messageId: 'sleep' });
      },
    };
  },
};
