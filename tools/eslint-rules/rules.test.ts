// RuleTester cases for every nimbus rule (TECH-10). Each `it` runs one rule's valid and invalid cases;
// RuleTester runs them inline (its own describe/it fallbacks) and throws on the first failure.
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import { nimbus } from './index.mjs';

const tester = new RuleTester({
  languageOptions: { parser: tseslint.parser, ecmaVersion: 2024, sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
});
const rule = (name: string) => nimbus.rules?.[name] as Parameters<RuleTester['run']>[1];

describe('nimbus ESLint rules', () => {
  it('TECH-10: no-direct-fetch flags fetch and axios, not the generated clients', () => {
    tester.run('no-direct-fetch', rule('no-direct-fetch'), {
      valid: ["import { listTenants } from '@nimbus/api-client/react'; listTenants({});", 'api.fetchNextPage();', 'customFetch(url);'],
      invalid: [
        { code: "fetch('/api/tenants');", errors: [{ messageId: 'fetch' }] },
        { code: "window.fetch('/api/vms');", errors: [{ messageId: 'fetch' }] },
        { code: "globalThis.fetch('/x');", errors: [{ messageId: 'fetch' }] },
        { code: "import axios from 'axios';", errors: [{ messageId: 'axios' }] },
      ],
    });
  });

  it('TECH-10: no-raw-permission flags permission strings, not the enum or other strings', () => {
    tester.run('no-raw-permission', rule('no-raw-permission'), {
      valid: ["can(session, Permission['vm:read']);", "events.publish('task:started', p);", "const url = 'http://x';", "t('storage.title');", "const label = 'ratio: 1:2';"],
      invalid: [
        { code: "can(session, 'vm:read');", errors: [{ messageId: 'raw' }] },
        { code: 'const p = `bucket:create`;', errors: [{ messageId: 'raw' }] },
        { code: "const all = ['tenant:read', 'quota:update'];", errors: 2 },
      ],
    });
  });

  it('TECH-10: no-role-check flags comparisons, switches and lookups on roles', () => {
    tester.run('no-role-check', rule('no-role-check'), {
      valid: ['if (can(session, Permission.x)) run();', "const label = t(`roles.${role}`);", 'if (session.tenant === null) pick();'],
      invalid: [
        { code: "if (session.role === 'provider_admin') x();", errors: [{ messageId: 'role' }] },
        { code: "if (role !== 'tenant_viewer') x();", errors: [{ messageId: 'role' }] },
        { code: 'switch (me.role) { default: }', errors: [{ messageId: 'role' }] },
        { code: "ADMINS.includes(session.role);", errors: [{ messageId: 'role' }] },
        { code: "me.role.startsWith('tenant');", errors: [{ messageId: 'role' }] },
      ],
    });
  });

  it('TECH-10: no-playwright-sleep flags waitForTimeout', () => {
    tester.run('no-playwright-sleep', rule('no-playwright-sleep'), {
      valid: ['await expect(page.getByRole("table")).toBeVisible();', 'await page.waitForURL(/x/);'],
      invalid: [{ code: 'await page.waitForTimeout(500);', errors: [{ messageId: 'sleep' }] }],
    });
  });

  it('TECH-10: test-name-has-id needs a known ID prefix at the start of the title', () => {
    tester.run('test-name-has-id', rule('test-name-has-id'), {
      valid: [
        "it('AC-TEN-2.4: blocks Next', () => {});",
        "test.skip('E2E-9: two tabs', () => {});",
        'it(`TECH-6: ${file} renders`, () => {});',
        'it(`${id}: from a table`, () => {});',
        'it(`AC-TEN-${n}: generated`, () => {});',
        'it(title, () => {});',
        "test.describe('Storage', () => {});",
        "describe('anything', () => {});",
      ],
      invalid: [
        { code: "it('renders the table', () => {});", errors: [{ messageId: 'missing' }] },
        { code: "test('FOO-1: unknown prefix', () => {});", errors: [{ messageId: 'missing' }] },
        { code: "test.only('AC-TEN-2.4 no colon', () => {});", errors: [{ messageId: 'missing' }] },
        { code: 'it(`renders ${name}`, () => {});', errors: [{ messageId: 'missing' }] },
      ],
    });
  });

  it('TECH-10: no-cross-remote-import flags imports between apps, not libs or own files', () => {
    tester.run('no-cross-remote-import', rule('no-cross-remote-import'), {
      valid: [
        { code: "import { x } from './data';", filename: '/repo/apps/storage/src/App.tsx' },
        { code: "import { createRootBus } from '@nimbus/mf-contract';", filename: '/repo/apps/storage/src/App.tsx' },
        { code: "import { a } from '../../tenants/src/url';", filename: '/repo/libs/ui-kit/src/x.ts' },
      ],
      invalid: [
        { code: "import { parsePath } from '../../tenants/src/url';", filename: '/repo/apps/storage/src/App.tsx', errors: [{ messageId: 'cross' }] },
        { code: "import { mount } from '@nimbus/compute';", filename: '/repo/apps/shell/src/x.ts', errors: [{ messageId: 'cross' }] },
        { code: "export * from '../../../apps/tenants/src/data';", filename: '/repo/apps/compute/src/a/b.ts', errors: [{ messageId: 'cross' }] },
        { code: "await import('@nimbus/storage/mount');", filename: '/repo/apps/tenants/src/x.ts', errors: [{ messageId: 'cross' }] },
      ],
    });
  });

  it('TECH-10: no-websocket-outside-realtime flags new WebSocket and EventSource', () => {
    tester.run('no-websocket-outside-realtime', rule('no-websocket-outside-realtime'), {
      valid: ["events.subscribe('server:vm.updated', fn);"],
      invalid: [
        { code: "new WebSocket('/api/events');", errors: [{ messageId: 'socket' }] },
        { code: "new window.WebSocket('/api/events');", errors: [{ messageId: 'socket' }] },
        { code: "new EventSource('/api/x');", errors: [{ messageId: 'socket' }] },
      ],
    });
  });

  it('TECH-10: no-handwritten-query-key flags array literals as keys', () => {
    tester.run('no-handwritten-query-key', rule('no-handwritten-query-key'), {
      valid: ['useQuery({ queryKey: getGetTenantQueryKey(id), queryFn });', 'qc.setQueryData(getGetQuotasQueryKey(id), q);', 'qc.invalidateQueries();'],
      invalid: [
        { code: "useQuery({ queryKey: ['tenants', id], queryFn });", errors: [{ messageId: 'key' }] },
        { code: "qc.invalidateQueries({ queryKey: ['/buckets'] });", errors: [{ messageId: 'key' }] },
        { code: "qc.setQueryData(['vms', id], vm);", errors: [{ messageId: 'key' }] },
      ],
    });
  });

  it('TECH-10: no-server-text flags problem.title and problem.detail', () => {
    tester.run('no-server-text', rule('no-server-text'), {
      valid: ['messageFor(error.problem);', 'const t = dialog.title;', 'problem.code;'],
      invalid: [
        { code: 'show(problem.detail);', errors: [{ messageId: 'text' }] },
        { code: 'show(error.problem.title);', errors: [{ messageId: 'text' }] },
        { code: "show(lastProblem['detail']);", errors: [{ messageId: 'text' }] },
      ],
    });
  });
});
