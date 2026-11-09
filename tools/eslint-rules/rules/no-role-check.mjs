// @ts-check
// AGENTS.md H3: never decide by role name. Use can(), <Can> or v-can with a Permission.
import { propertyName, staticString } from './_util.mjs';
const ROLES = new Set(['provider_admin', 'reseller_admin', 'tenant_admin', 'tenant_viewer']);
const isRole = (node) => propertyName(node) === 'role' || ROLES.has(staticString(node) ?? '');
/** @type {import('eslint').Rule.RuleModule} */
export const noRoleCheck = {
  meta: {
    type: 'problem',
    docs: { description: 'Check permissions with can(), not role names (AGENTS.md H3).' },
    messages: {
      role: 'Check a permission with can(session, Permission[…]) instead of comparing roles (AGENTS.md H3).',
    },
    schema: [],
  },
  create(context) {
    return {
      BinaryExpression(node) {
        if (!['===', '!==', '==', '!='].includes(node.operator)) return;
        if (isRole(node.left) || isRole(node.right)) context.report({ node, messageId: 'role' });
      },
      SwitchStatement(node) {
        if (propertyName(node.discriminant) === 'role') context.report({ node, messageId: 'role' });
      },
      CallExpression(node) {
        // ['tenant_admin', …].includes(session.role), role.startsWith('tenant')
        const callee = node.callee;
        if (callee.type !== 'MemberExpression') return;
        const method = propertyName(callee);
        if ((method === 'includes' || method === 'indexOf') && node.arguments.some((a) => propertyName(a) === 'role'))
          context.report({ node, messageId: 'role' });
        if ((method === 'startsWith' || method === 'endsWith') && propertyName(callee.object) === 'role')
          context.report({ node, messageId: 'role' });
      },
    };
  },
};
