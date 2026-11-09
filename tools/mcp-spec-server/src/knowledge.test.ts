// TECH-8: every tool answers from the real specs, contract and tests; the server answers over stdio.
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { describe, expect, it } from 'vitest';
import { coverageFor, getOperation, getPermissions, getRequirement, loadKnowledge, searchSpecs } from './knowledge.mjs';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const kb = loadKnowledge(REPO);

describe('MCP spec server', () => {
  it('TECH-8: get_requirement links REQ → US → SPEC → AC, with the AC status', () => {
    expect(getRequirement(kb, 'REQ-3')).toMatchObject({ found: true, kind: 'req', children: expect.arrayContaining(['US-3.1']) });
    expect(getRequirement(kb, 'US-3.1')).toMatchObject({ parents: ['REQ-3'], children: expect.arrayContaining(['SPEC-TEN-2']) });
    expect(getRequirement(kb, 'SPEC-TEN-2')).toMatchObject({ kind: 'spec', parents: expect.arrayContaining(['US-3.1']), children: expect.arrayContaining(['AC-TEN-2.4']) });
    expect(getRequirement(kb, 'AC-TEN-2.4')).toMatchObject({ kind: 'ac', status: 'done', parents: ['SPEC-TEN-2'], file: expect.stringMatching(/SPEC-TEN-2/) });
    expect(getRequirement(kb, 'RT-1')).toMatchObject({ found: true, text: expect.stringMatching(/socket|WebSocket/i) });
    expect(getRequirement(kb, 'AC-NOPE-1.1')).toMatchObject({ found: false });
  });

  it('TECH-8: search_specs finds sections containing every word, with their IDs', () => {
    const hits = searchSpecs(kb, 'bucket not empty');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.ids.includes('AC-STO-2.4'))).toBe(true);
    expect(searchSpecs(kb, 'zzzz qqqq')).toEqual([]);
  });

  it('TECH-8: get_operation returns the method, path, permission and error statuses from openapi.yaml', () => {
    expect(getOperation(kb, 'createBucket')).toMatchObject({ found: true, method: 'POST', path: '/api/buckets', permission: 'bucket:create', errorStatuses: expect.arrayContaining(['409']) });
    expect(getOperation(kb, 'getVitalsSummary')).toMatchObject({ permission: 'vitals:read' });
    expect(getOperation(kb, 'nope')).toMatchObject({ found: false, hint: expect.stringContaining('listTenants') });
  });

  it('TECH-8: get_permissions answers by role and by permission', () => {
    const tenantAdmin = getPermissions(kb, 'tenant_admin') as { permissions: { permission: string }[] };
    expect(tenantAdmin.permissions.map((p) => p.permission)).toEqual(expect.arrayContaining(['bucket:create', 'bucket:delete', 'vm:operate']));
    expect(tenantAdmin.permissions.map((p) => p.permission)).not.toContain('tenant:read');
    expect(getPermissions(kb, 'vitals:read')).toMatchObject({ permission: 'vitals:read', roles: { provider_admin: '✅', reseller_admin: '—' } });
    expect(getPermissions(kb, 'tenant:read')).toMatchObject({ roles: { provider_admin: '✅ all', reseller_admin: '✅ own' } });
  });

  it('TECH-8: coverage_for lists the tests titled with an AC and its status', () => {
    const coverage = coverageFor(kb, 'AC-STO-2.4');
    expect(coverage).toMatchObject({ id: 'AC-STO-2.4', status: 'done', spec: 'SPEC-STO-2', lastCiStatus: 'unknown' });
    expect(coverage.tests.map((t) => t.file)).toEqual(expect.arrayContaining(['apps/storage/src/StorageArea.test.tsx', 'apps/e2e/src/storage.exclusive.spec.ts']));
    expect(coverage.tests.every((t) => t.title.startsWith('AC-STO-2.4:'))).toBe(true);
  });

  it('TECH-8: the server lists the five tools over stdio and answers a call', async () => {
    const client = new Client({ name: 'test', version: '1.0.0' });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('./main.mjs', import.meta.url))], cwd: REPO }));
    try {
      expect((await client.listTools()).tools.map((t) => t.name).sort()).toEqual(['coverage_for', 'get_operation', 'get_permissions', 'get_requirement', 'search_specs']);
      const result = await client.callTool({ name: 'get_operation', arguments: { operationId: 'deleteBucket' } });
      const text = (result.content as { text: string }[])[0]?.text ?? '';
      expect(JSON.parse(text)).toMatchObject({ method: 'DELETE', permission: 'bucket:delete' });
    } finally {
      await client.close();
    }
  }, 20_000);
});
