import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Task, Tenant } from '@nimbus/api-client/model';
import type { MockApi } from './app';
import { parseConfig } from './config';
import { GIB } from './db';
import { ORIGIN, call, createApp, login, openEvents, until } from './test-helpers';

let app: MockApi;
beforeEach(async () => {
  app = await createApp();
});
afterEach(async () => {
  await app.close();
});

const firstTenant = (predicate: (t: Tenant) => boolean) => [...app.mock.db().tenants.values()].find(predicate) as Tenant;

describe('configuration', () => {
  it('TECH-3: refuses to start without a valid NIMBUS_MODE', () => {
    expect(() => parseConfig({})).toThrow(/NIMBUS_MODE/);
    expect(() => parseConfig({ NIMBUS_MODE: 'production' })).toThrow(/NIMBUS_MODE/);
  });

  it('TECH-3: the mode sets defaults and MOCK_* variables override them', () => {
    expect(parseConfig({ NIMBUS_MODE: 'e2e' })).toMatchObject({ latencyMs: 0, failureRate: 0, seed: 42, testEndpoints: true });
    expect(parseConfig({ NIMBUS_MODE: 'demo' })).toMatchObject({ latencyMs: 150, failureRate: 0.1, testEndpoints: false });
    expect(parseConfig({ NIMBUS_MODE: 'e2e', MOCK_LATENCY_MS: '150', MOCK_FAILURE_RATE: '0.1' })).toMatchObject({ latencyMs: 150, failureRate: 0.1 });
  });

  it('TECH-3: test endpoints do not exist in demo mode', async () => {
    const demo = await createApp({ mode: 'demo', testEndpoints: false });
    expect((await call(demo, { method: 'POST', url: '/api/__test/reset' })).status).toBe(404);
    await demo.close();
  });
});

describe('session and CSRF (ADR-0005, NFR-SEC-6)', () => {
  it('TECH-3: login returns Me and sets an HttpOnly, Secure, SameSite=Strict cookie on /api', async () => {
    const res = await call(app, { method: 'POST', url: '/api/login', body: { role: 'tenant_admin' } });
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toMatch(/^nimbus_session=demo\.tenant_admin\.[0-9a-f]+; HttpOnly; Secure; SameSite=Strict; Path=\/api; Max-Age=28800$/);
    expect(res.json).toMatchObject({ role: 'tenant_admin', tenant: { id: 't_acme', planName: 'Business', status: 'active' } });
  });

  it('AC-SHL-1.10: a mutation without X-Nimbus-Csrf, or with a foreign Origin, gets 403 FORBIDDEN', async () => {
    const cookie = await login(app, 'tenant_admin');
    const noCsrf = await call(app, { method: 'POST', url: '/api/buckets', cookie, body: { name: 'x-bucket' }, csrf: false, headers: { origin: ORIGIN } });
    const foreign = await call(app, { method: 'POST', url: '/api/buckets', cookie, body: { name: 'x-bucket' }, headers: { origin: 'https://evil.example' } });
    const noOrigin = await call(app, { method: 'POST', url: '/api/buckets', cookie, body: { name: 'x-bucket' }, csrf: false, headers: { 'x-nimbus-csrf': '1' } });
    for (const res of [noCsrf, foreign, noOrigin]) expect(res).toMatchObject({ status: 403, json: { code: 'FORBIDDEN' } });
  });

  it('TECH-3: reportVitals needs no CSRF header but still checks Origin', async () => {
    const record = { metric: 'LCP', value: 1200, rating: 'good', route: '/tenants', remote: 'tenants', navigationType: 'navigate', ts: new Date().toISOString() };
    expect((await call(app, { method: 'POST', url: '/api/rum', body: [record], csrf: false, headers: { origin: ORIGIN } })).status).toBe(204);
    expect((await call(app, { method: 'POST', url: '/api/rum', body: [record], csrf: false, headers: { origin: 'https://evil.example' } })).status).toBe(403);
  });

  it('TECH-3: logout clears the cookie; the old session gets 401', async () => {
    const cookie = await login(app, 'provider_admin');
    const out = await call(app, { method: 'POST', url: '/api/logout', cookie });
    expect(out.status).toBe(204);
    expect(out.headers['set-cookie']).toContain('Max-Age=0');
    expect(await call(app, { url: '/api/me', cookie })).toMatchObject({ status: 401, json: { code: 'UNAUTHENTICATED' } });
  });
});

describe('RBAC from x-permission and scoping', () => {
  it('TECH-3: denies each role what the matrix denies', async () => {
    const viewer = await login(app, 'tenant_viewer');
    const tenantAdmin = await login(app, 'tenant_admin');
    const reseller = await login(app, 'reseller_admin');
    const provider = await login(app, 'provider_admin');
    expect((await call(app, { url: '/api/tenants' })).status).toBe(401);
    expect((await call(app, { url: '/api/tenants', cookie: tenantAdmin })).status).toBe(403);
    expect((await call(app, { method: 'POST', url: '/api/buckets', cookie: viewer, body: { name: 'viewer-bucket' } })).status).toBe(403);
    expect((await call(app, { method: 'POST', url: '/api/vms/vm_01/actions', cookie: viewer, body: { action: 'reboot' } })).status).toBe(403);
    expect((await call(app, { method: 'POST', url: '/api/tenants/t_acme/suspend', cookie: reseller })).status).toBe(403);
    expect((await call(app, { method: 'POST', url: '/api/buckets', cookie: provider, body: { name: 'provider-bucket' } })).status).toBe(403);
    expect((await call(app, { url: '/api/plans', cookie: viewer })).status).toBe(403);
  });

  it('TECH-3: a reseller sees only their 1,200 tenants and gets 404 for others', async () => {
    const reseller = await login(app, 'reseller_admin');
    const page = await call(app, { url: '/api/tenants?limit=200', cookie: reseller });
    expect(page.json).toMatchObject({ total: 1200 });
    expect((page.json as { items: Tenant[] }).items.every((t) => t.resellerId === 'r_northwind')).toBe(true);
    const foreign = firstTenant((t) => t.resellerId === 'r_bluepeak');
    expect((await call(app, { url: `/api/tenants/${foreign.id}`, cookie: reseller })).status).toBe(404);
    expect((await call(app, { url: `/api/vms?tenantId=${foreign.id}`, cookie: reseller })).status).toBe(404);
  });

  it('TECH-3: admins must pass tenantId to listVms / listBuckets (422); tenant roles get their own tenant', async () => {
    const provider = await login(app, 'provider_admin');
    expect(await call(app, { url: '/api/vms', cookie: provider })).toMatchObject({ status: 422, json: { code: 'VALIDATION_FAILED' } });
    expect(await call(app, { url: '/api/buckets', cookie: provider })).toMatchObject({ status: 422 });
    expect((await call(app, { url: '/api/vms?tenantId=t_acme', cookie: provider })).json).toMatchObject({ total: 40 });
    const tenantAdmin = await login(app, 'tenant_admin');
    expect((await call(app, { url: '/api/vms', cookie: tenantAdmin })).json).toMatchObject({ total: 40 });
    expect((await call(app, { url: '/api/buckets', cookie: tenantAdmin })).json).toMatchObject({ total: 15 });
  });

  it('TECH-3: seeded t_acme data matches mock-data (D2-05, F5)', async () => {
    const tenantAdmin = await login(app, 'tenant_admin');
    expect((await call(app, { url: '/api/tenants/t_acme/quotas', cookie: tenantAdmin })).json).toMatchObject({
      storageQuotaBytes: 250 * GIB, storageUsedBytes: 205 * GIB, vmQuota: 50, vmCount: 40,
    });
    expect((await call(app, { url: '/api/vms/vm_01', cookie: tenantAdmin })).json).toMatchObject({ name: 'web-01' });
    const tasks = (await call(app, { url: '/api/tasks', cookie: tenantAdmin })).json as { total: number };
    expect(tasks.total).toBe(5);
  });
});

describe('errors from specs/mock-data.md §9', () => {
  it('TECH-3: tenant errors', async () => {
    const provider = await login(app, 'provider_admin');
    const create = (body: object) => call(app, { method: 'POST', url: '/api/tenants', cookie: provider, body });
    const base = { name: 'new-co', adminEmail: 'a@new.test', planId: 'p_starter', storageQuotaBytes: 10 * GIB, vmQuota: 2 };
    expect((await create({ ...base, name: 'acme' })).json).toMatchObject({ code: 'TENANT_NAME_TAKEN', status: 409 });
    expect((await create({ ...base, storageQuotaBytes: 200 * GIB })).json).toMatchObject({
      code: 'QUOTA_EXCEEDS_PLAN', params: { resource: 'storage', plan: 'Starter', max: 100 * GIB },
    });
    expect((await create({ ...base, vmQuota: 20 })).json).toMatchObject({ code: 'QUOTA_EXCEEDS_PLAN', params: { resource: 'vms', max: 10 } });
    expect((await create({ ...base, name: 'Acme Corp' })).json).toMatchObject({ code: 'VALIDATION_FAILED', errors: [{ field: 'name' }] });
    const suspended = firstTenant((t) => t.status === 'suspended');
    expect((await call(app, { method: 'POST', url: `/api/tenants/${suspended.id}/suspend`, cookie: provider })).json).toMatchObject({ code: 'TENANT_NOT_ACTIVE' });
    expect((await call(app, { method: 'POST', url: '/api/tenants/t_acme/resume', cookie: provider })).json).toMatchObject({ code: 'TENANT_NOT_SUSPENDED' });
  });

  it('TECH-3: quota errors carry params.resource', async () => {
    const provider = await login(app, 'provider_admin');
    const put = (body: object) => call(app, { method: 'PUT', url: '/api/tenants/t_acme/quotas', cookie: provider, body });
    expect((await put({ storageQuotaBytes: 100 * GIB })).json).toMatchObject({ code: 'QUOTA_BELOW_USAGE', params: { resource: 'storage', used: 205 * GIB } });
    expect((await put({ vmQuota: 10 })).json).toMatchObject({ code: 'QUOTA_BELOW_USAGE', params: { resource: 'vms', used: 40 } });
    expect((await put({ storageQuotaBytes: 2048 * GIB })).json).toMatchObject({ code: 'QUOTA_EXCEEDS_PLAN', params: { resource: 'storage', plan: 'Business' } });
    expect((await put({ storageQuotaBytes: 300 * GIB })).status).toBe(200);
  });

  it('TECH-3: VM errors', async () => {
    const tenantAdmin = await login(app, 'tenant_admin');
    const db = app.mock.db();
    const running = db.vmsOf('t_acme').find((v) => v.status === 'running')!;
    const act = (vmId: string, action: string) => call(app, { method: 'POST', url: `/api/vms/${vmId}/actions`, cookie: tenantAdmin, body: { action } });
    expect((await act(running.id, 'start')).json).toMatchObject({ code: 'VM_INVALID_STATE', params: { name: running.name, action: 'start', status: 'running' } });
    expect((await act(running.id, 'reboot')).status).toBe(202);
    expect((await act(running.id, 'stop')).json).toMatchObject({ code: 'VM_BUSY', params: { name: running.name } });
    expect((await act(running.id, 'explode')).json).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect((await act('vm_99', 'start')).status).toBe(404);
  });

  it('TECH-3: changes to a suspended tenant return TENANT_SUSPENDED, whoever calls', async () => {
    app.mock.db().tenants.get('t_acme')!.status = 'suspended';
    const tenantAdmin = await login(app, 'tenant_admin');
    const provider = await login(app, 'provider_admin');
    expect((await call(app, { method: 'POST', url: '/api/vms/vm_02/actions', cookie: provider, body: { action: 'reboot' } })).json).toMatchObject({ code: 'TENANT_SUSPENDED' });
    expect((await call(app, { method: 'POST', url: '/api/buckets', cookie: tenantAdmin, body: { name: 'acme-new' } })).json).toMatchObject({ code: 'TENANT_SUSPENDED' });
    expect((await call(app, { method: 'PUT', url: '/api/tenants/t_acme/quotas', cookie: provider, body: { vmQuota: 45 } })).json).toMatchObject({ code: 'TENANT_SUSPENDED' });
  });

  it('AC-CMP-4.6: runVmAction as provider_admin on a suspended tenant returns 409 TENANT_SUSPENDED', async () => {
    app.mock.db().tenants.get('t_acme')!.status = 'suspended';
    const provider = await login(app, 'provider_admin');
    const res = await call(app, { method: 'POST', url: '/api/vms/vm_01/actions', cookie: provider, body: { action: 'reboot' } });
    expect(res).toMatchObject({ status: 409, json: { code: 'TENANT_SUSPENDED' } });
    expect(app.mock.db().vm('vm_01')?.activeTaskId).toBeNull();
  });

  it('TECH-3: other tenants get deterministic buckets that add up to their usage (D8-04)', async () => {
    const provider = await login(app, 'provider_admin');
    const used = firstTenant((t) => t.id !== 't_acme' && t.storageUsedBytes > 10 * GIB);
    const empty = firstTenant((t) => t.id !== 't_acme' && t.storageUsedBytes === 0) ?? (() => {
      const t = firstTenant((x) => x.id !== 't_acme' && x.id !== used.id);
      t.storageUsedBytes = 0;
      return t;
    })();
    const list = async (tenantId: string) => (await call(app, { method: 'GET', url: `/api/buckets?tenantId=${tenantId}&limit=200`, cookie: provider })).json as { items: Array<{ name: string; sizeBytes: number; tenantId: string }> };
    const first = await list(used.id);
    expect(first.items.length).toBeGreaterThan(0);
    expect(first.items.length).toBeLessThanOrEqual(8);
    expect(first.items.every((b) => b.tenantId === used.id && b.name.startsWith(`${used.name}-`))).toBe(true);
    expect(first.items.reduce((sum, b) => sum + b.sizeBytes, 0)).toBe(used.storageUsedBytes);
    expect((await list(used.id)).items).toEqual(first.items);
    expect((await list(empty.id)).items).toEqual([]);
    const again = await createApp();
    const viaOther = (await call(again, { method: 'GET', url: `/api/buckets?tenantId=${used.id}&limit=200`, cookie: await login(again, 'provider_admin') })).json as typeof first;
    expect(viaOther.items.map((b) => [b.name, b.sizeBytes])).toEqual(first.items.map((b) => [b.name, b.sizeBytes]));
    await again.close();
  });

  it('TECH-3: bucket errors', async () => {
    const tenantAdmin = await login(app, 'tenant_admin');
    const create = (name: string) => call(app, { method: 'POST', url: '/api/buckets', cookie: tenantAdmin, body: { name } });
    expect((await create('acme-assets')).json).toMatchObject({ code: 'BUCKET_NAME_TAKEN' });
    expect((await create('My_Bucket')).json).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect((await create('192.168.1.1')).json).toMatchObject({ code: 'VALIDATION_FAILED', errors: [{ field: 'name' }] });
    expect((await call(app, { method: 'DELETE', url: '/api/buckets/acme-backups', cookie: tenantAdmin })).json).toMatchObject({ code: 'BUCKET_NOT_EMPTY' });
    expect((await call(app, { method: 'DELETE', url: '/api/buckets/acme-scratch', cookie: tenantAdmin })).status).toBe(204);
    await call(app, { method: 'POST', url: '/api/__test/set-usage', body: { tenantId: 't_acme', usedBytes: 250 * GIB } });
    expect((await create('acme-full')).json).toMatchObject({ code: 'QUOTA_EXCEEDED', status: 422 });
  });

  it('TECH-3: reportVitals is rate-limited per client IP (X-Forwarded-For from the gateway) and size-limited', async () => {
    const record = { metric: 'INP', value: 80, rating: 'good', route: '/compute', remote: 'compute', navigationType: 'navigate', ts: new Date().toISOString() };
    const post = (ip: string, body: unknown = [record]) =>
      call(app, { method: 'POST', url: '/api/rum', body, csrf: false, headers: { origin: ORIGIN, 'x-forwarded-for': ip } });
    for (let i = 0; i < 60; i++) expect((await post('10.1.1.1')).status).toBe(204);
    expect((await post('10.1.1.1')).json).toMatchObject({ code: 'RATE_LIMITED', status: 429 });
    expect((await post('10.2.2.2')).status).toBe(204);
    expect((await post('10.3.3.3', Array.from({ length: 200 }, () => record))).status).toBe(413);
    expect((await post('10.4.4.4', [{ ...record, metric: 'NOPE' }])).json).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('TECH-3: a body-less POST with a JSON content type works; malformed JSON is VALIDATION_FAILED', async () => {
    const provider = await login(app, 'provider_admin');
    const suspend = await call(app, { method: 'POST', url: '/api/tenants/t_acme/suspend', cookie: provider, headers: { 'content-type': 'application/json' } });
    expect(suspend.status).toBe(202);
    const bad = await app.inject({
      method: 'POST', url: '/api/tenants', payload: '{nope', headers: { cookie: provider, origin: ORIGIN, 'x-nimbus-csrf': '1', 'content-type': 'application/json' },
    });
    expect(bad.statusCode).toBe(422);
    expect(bad.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('TECH-3: unknown routes are 404 NOT_FOUND problems', async () => {
    const provider = await login(app, 'provider_admin');
    expect((await call(app, { url: '/api/tenants/t_nope0', cookie: provider })).json).toMatchObject({ code: 'NOT_FOUND' });
    expect((await call(app, { url: '/api/tasks/task_nope', cookie: provider })).json).toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('lists', () => {
  it('TECH-3: cursor pagination walks the whole result without duplicates', async () => {
    const tenantAdmin = await login(app, 'tenant_admin');
    const names: string[] = [];
    let cursor: string | null = null;
    do {
      const page: { json: { items: { name: string }[]; nextCursor: string | null; total: number } } = await call(app, {
        url: `/api/vms?limit=15${cursor ? `&cursor=${cursor}` : ''}`,
        cookie: tenantAdmin,
      });
      names.push(...page.json.items.map((v) => v.name));
      cursor = page.json.nextCursor;
    } while (cursor);
    expect(names).toHaveLength(40);
    expect(new Set(names).size).toBe(40);
    expect((await call(app, { url: '/api/vms?cursor=%%%', cookie: tenantAdmin })).status).toBe(422);
  });

  it('TECH-3: search, filter and sort tenants', async () => {
    const provider = await login(app, 'provider_admin');
    const acme = await call(app, { url: '/api/tenants?q=acme', cookie: provider });
    expect((acme.json as { items: Tenant[] }).items.map((t) => t.id)).toContain('t_acme');
    const suspended = (await call(app, { url: '/api/tenants?status=suspended&limit=200', cookie: provider })).json as { items: Tenant[]; total: number };
    expect(suspended.total).toBe(800);
    expect(suspended.items.every((t) => t.status === 'suspended')).toBe(true);
    const sorted = ((await call(app, { url: '/api/tenants?sort=-storageUsedBytes&limit=50', cookie: provider })).json as { items: Tenant[] }).items;
    expect(sorted.map((t) => t.storageUsedBytes)).toEqual([...sorted.map((t) => t.storageUsedBytes)].sort((a, b) => b - a));
  });

  it('TECH-3: createTenant returns TenantCreated with a seq-0 provisioning task', async () => {
    const reseller = await login(app, 'reseller_admin');
    const res = await call(app, {
      method: 'POST', url: '/api/tenants', cookie: reseller,
      body: { name: 'fresh-co', adminEmail: 'a@fresh.test', planId: 'p_business', storageQuotaBytes: 100 * GIB, vmQuota: 5 },
    });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ tenant: { status: 'provisioning', resellerId: 'r_northwind' }, task: { kind: 'tenant.provision', seq: 0 } });
  });
});

describe('realtime (WebSocket /api/events)', () => {
  it('TECH-3: a VM reboot emits task.updated with increasing seq, then completion, then vm.updated', async () => {
    const cookie = await login(app, 'tenant_admin');
    const events = await openEvents(app, cookie);
    const res = await call(app, { method: 'POST', url: '/api/vms/vm_01/actions', cookie, body: { action: 'reboot' } });
    expect(res.json).toMatchObject({ kind: 'vm.reboot', seq: 0, status: 'queued' });
    await until(() => events.messages.some((m) => m.type === 'vm.updated' && m.vm.status === 'running'));
    const tasks = events.messages.filter((m) => m.type === 'task.updated').map((m) => (m as { task: Task }).task);
    expect(tasks.length).toBeGreaterThan(3);
    expect(tasks.map((t) => t.seq)).toEqual([...tasks.map((t) => t.seq)].sort((a, b) => a - b));
    expect(new Set(tasks.map((t) => t.seq)).size).toBe(tasks.length);
    expect(tasks.at(-1)).toMatchObject({ status: 'succeeded', progress: 100 });
    const vmEvents = events.messages.filter((m) => m.type === 'vm.updated');
    expect(vmEvents[0]).toMatchObject({ vm: { status: 'rebooting' } });
    expect(events.messages.indexOf(vmEvents.at(-1)!)).toBeGreaterThan(events.messages.findIndex((m) => m.type === 'task.updated' && m.task.status === 'succeeded'));
    events.ws.terminate();
  });

  it('TECH-3: in real time a reboot finishes within 5–8 s (specs/mock-data.md §7)', async () => {
    const realTime = await createApp({ timeScale: 1 });
    const cookie = await login(realTime, 'tenant_admin');
    const events = await openEvents(realTime, cookie);
    const start = Date.now();
    await call(realTime, { method: 'POST', url: '/api/vms/vm_03/actions', cookie, body: { action: realTime.mock.db().vm('vm_03')?.status === 'running' ? 'reboot' : 'start' } });
    await until(() => events.messages.some((m) => m.type === 'task.updated' && m.task.finishedAt !== null), 10_000);
    const seconds = (Date.now() - start) / 1000;
    expect(seconds).toBeGreaterThanOrEqual(3); // vm.start is 3–5 s, vm.reboot 5–8 s
    expect(seconds).toBeLessThanOrEqual(8.1);
    events.ws.terminate();
    await realTime.close();
  });

  it('TECH-3: a forced failure (fail-next-task) fails the task with the given code and restores the VM', async () => {
    const cookie = await login(app, 'tenant_admin');
    const events = await openEvents(app, cookie);
    await call(app, { method: 'POST', url: '/api/__test/fail-next-task', body: { kind: 'vm.reboot', code: 'VM_BUSY' } });
    await call(app, { method: 'POST', url: '/api/vms/vm_01/actions', cookie, body: { action: 'reboot' } });
    await until(() => events.messages.some((m) => m.type === 'task.updated' && m.task.status === 'failed'));
    const failed = events.messages.find((m) => m.type === 'task.updated' && m.task.status === 'failed') as { task: Task };
    expect(failed.task.error).toMatchObject({ code: 'VM_BUSY', params: { name: 'web-01' } });
    await until(() => events.messages.some((m) => m.type === 'vm.updated' && m.vm.status === 'running' && m.vm.activeTaskId === null));
    events.ws.terminate();
  });

  it('AC-CMP-2.2: a failed VM task is followed by a vm.updated with the status from before the action', async () => {
    const cookie = await login(app, 'tenant_admin');
    const events = await openEvents(app, cookie);
    await call(app, { method: 'POST', url: '/api/__test/fail-next-task', body: { kind: 'vm.reboot', code: 'VM_BUSY' } });
    await call(app, { method: 'POST', url: '/api/vms/vm_01/actions', cookie, body: { action: 'reboot' } });
    await until(() => events.messages.some((m) => m.type === 'vm.updated' && m.vm.activeTaskId === null));
    const failedAt = events.messages.findIndex((m) => m.type === 'task.updated' && m.task.status === 'failed');
    const reverted = events.messages.findIndex((m) => m.type === 'vm.updated' && m.vm.activeTaskId === null);
    expect(failedAt).toBeGreaterThan(-1);
    expect(reverted).toBeGreaterThan(failedAt); // the final task.updated first, then the server's latest VM status
    expect(events.messages[reverted]).toMatchObject({ vm: { id: 'vm_01', status: 'running' } });
    events.ws.terminate();
  });

  it('TECH-3: the socket closes with 4401 when the session expires', async () => {
    const cookie = await login(app, 'tenant_admin');
    const events = await openEvents(app, cookie);
    await call(app, { method: 'POST', url: '/api/__test/expire-session', cookie });
    expect(await events.closed).toBe(4401);
  });

  it('TECH-3: a handshake without a session is refused with 401, and a foreign Origin is closed with 4403', async () => {
    expect(await call(app, { url: '/api/events', headers: { origin: ORIGIN } })).toMatchObject({ status: 401, json: { code: 'UNAUTHENTICATED' } });
    const cookie = await login(app, 'tenant_admin');
    const events = await openEvents(app, cookie, 'https://evil.example');
    expect(await events.closed).toBe(4403);
  });

  it('AC-SHL-6.4: drop-sockets closes the caller\'s sockets with 1001 and holdMs refuses upgrades for that long (D4-05)', async () => {
    const cookie = await login(app, 'tenant_admin');
    const events = await openEvents(app, cookie);
    expect(await call(app, { method: 'POST', url: '/api/__test/drop-sockets', cookie, body: { holdMs: 300 } })).toMatchObject({ status: 204 });
    expect(await events.closed).toBe(1001);
    expect(await call(app, { url: '/api/events', cookie, headers: { origin: ORIGIN } })).toMatchObject({ status: 503 });
    await new Promise((resolve) => setTimeout(resolve, 350));
    const again = await openEvents(app, cookie);
    expect(again.closeCode()).toBeUndefined();
    again.ws.terminate();
    expect(await call(app, { method: 'POST', url: '/api/__test/drop-sockets', cookie, body: { holdMs: -1 } })).toMatchObject({ status: 422 });
  });

  it('TECH-3: the 6th socket of one session closes with 4429', async () => {
    const cookie = await login(app, 'tenant_admin');
    const sockets = [];
    for (let i = 0; i < 5; i++) sockets.push(await openEvents(app, cookie));
    const sixth = await openEvents(app, cookie);
    expect(await sixth.closed).toBe(4429);
    expect(sockets.every((s) => s.closeCode() === undefined)).toBe(true);
    for (const s of sockets) s.ws.terminate();
  });

  it('AC-SHL-6.14: a tenant_admin socket receives no events about other tenants', async () => {
    const cookie = await login(app, 'tenant_admin');
    const events = await openEvents(app, cookie);
    const other = firstTenant((t) => t.id !== 't_acme');
    await call(app, { method: 'POST', url: '/api/__test/emit', body: { type: 'tenant.updated', tenant: { id: other.id, status: 'suspended' } } });
    await call(app, { method: 'POST', url: '/api/__test/emit', body: { type: 'quota.updated', tenantId: other.id, quotas: { storageQuotaBytes: 1, storageUsedBytes: 0, vmQuota: 1, vmCount: 0, planMaxStorageQuotaBytes: 1, planMaxVmQuota: 1 } } });
    await call(app, { method: 'POST', url: '/api/__test/emit', body: { type: 'tenant.updated', tenant: { id: 't_acme', status: 'active' } } });
    await until(() => events.messages.length > 0);
    expect(events.messages.map((m) => m.type === 'tenant.updated' && m.tenant.id)).toEqual(['t_acme']);
    events.ws.terminate();
  });

  it('AC-SHL-6.15: a tenant_viewer socket receives tenant.updated for t_acme and nothing for other tenants', async () => {
    const cookie = await login(app, 'tenant_viewer');
    const events = await openEvents(app, cookie);
    const other = firstTenant((t) => t.id !== 't_acme');
    await call(app, { method: 'POST', url: '/api/__test/emit', body: { type: 'tenant.updated', tenant: { id: other.id, status: 'error' } } });
    await call(app, { method: 'POST', url: '/api/__test/emit', body: { type: 'tenant.updated', tenant: { id: 't_acme', status: 'suspended' } } });
    await until(() => events.messages.length > 0);
    expect(events.messages).toEqual([{ type: 'tenant.updated', tenant: { id: 't_acme', status: 'suspended' } }]);
    events.ws.terminate();
  });
});

describe('quotas (SPEC-TEN-3)', () => {
  it('AC-TEN-3.8: updateQuotas emits quota.updated with the new values', async () => {
    const cookie = await login(app, 'reseller_admin');
    const events = await openEvents(app, cookie);
    const GIB = 1024 ** 3;
    const res = await call(app, { method: 'PUT', url: '/api/tenants/t_acme/quotas', cookie, body: { storageQuotaBytes: 300 * GIB, vmQuota: 45 } });
    expect(res).toMatchObject({ status: 200, json: { storageQuotaBytes: 300 * GIB, vmQuota: 45 } });
    await until(() => events.messages.some((m) => m.type === 'quota.updated'));
    expect(events.messages.find((m) => m.type === 'quota.updated')).toEqual({ type: 'quota.updated', tenantId: 't_acme', quotas: res.json });
    events.ws.terminate();
  });
});

describe('test endpoints', () => {
  it('TECH-3: reset re-seeds data and seeded task times relative to now', async () => {
    const tenantAdmin = await login(app, 'tenant_admin');
    await call(app, { method: 'DELETE', url: '/api/buckets/acme-scratch', cookie: tenantAdmin });
    await call(app, { method: 'POST', url: '/api/__test/reset' });
    expect((await call(app, { url: '/api/buckets', cookie: tenantAdmin })).json).toMatchObject({ total: 15 });
    const seeded = app.mock.db().tasks.get('task_seed1') as Task;
    expect(Date.now() - Date.parse(seeded.createdAt)).toBeLessThan(11 * 60_000);
  });
});
