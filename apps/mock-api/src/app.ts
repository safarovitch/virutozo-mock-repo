// mock-api (TECH-3): every operation in contracts/openapi.yaml under /api, plus the WebSocket and test endpoints.
// Contract rules: cookie session + CSRF/Origin (ADR-0005, NFR-SEC-6), RBAC from x-permission, request validation
// with the generated Zod schemas (422 VALIDATION_FAILED), errors as problem+json (API-2).
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import websocket from '@fastify/websocket';
import type { ZodType } from 'zod';
import type { ErrorCode, Me, ServerEvent, Task, TaskKind, Tenant, TenantQuotas, Vm, VmAction, VitalSummary } from '@nimbus/api-client/model';
import * as Z from '@nimbus/api-client/zod';
import type { MockApiConfig } from './config';
import { loadOperationPermissions } from './contract';
import { Db, PLANS, planById, type DemoUser } from './db';
import { CLOSE, Hub } from './hub';
import { fieldErrors, sendProblem } from './problems';
import { PERMISSIONS, inScope, isTenantRole } from './rbac';
import { Sessions, tokenFromCookie, type Session } from './sessions';
import { TaskRunner } from './tasks';

declare module 'fastify' {
  interface FastifyRequest {
    session?: Session;
  }
  interface FastifyInstance {
    /** Internals for integration tests. */
    mock: { hub: Hub; sessions: Sessions; runner: TaskRunner; db: () => Db };
  }
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const NO_AUTH = new Set(['login', 'reportVitals']);
const TEST_PREFIX = '/api/__test/';
const RUM_LIMIT_PER_MINUTE = 60;
const ERROR_CODES: ErrorCode[] = ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'VALIDATION_FAILED', 'TENANT_NAME_TAKEN', 'TENANT_NOT_ACTIVE', 'TENANT_NOT_SUSPENDED', 'TENANT_SUSPENDED', 'QUOTA_EXCEEDS_PLAN', 'QUOTA_BELOW_USAGE', 'QUOTA_EXCEEDED', 'VM_BUSY', 'VM_INVALID_STATE', 'BUCKET_NAME_TAKEN', 'BUCKET_NOT_EMPTY', 'RATE_LIMITED', 'INTERNAL'];
const TASK_KINDS: TaskKind[] = ['vm.start', 'vm.stop', 'vm.reboot', 'tenant.suspend', 'tenant.resume', 'tenant.provision'];
const VITAL_THRESHOLDS: Record<string, [number, number]> = { LCP: [2500, 4000], INP: [200, 500], CLS: [0.1, 0.25], FCP: [1800, 3000], TTFB: [800, 1800] };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pathOf = (url: string) => url.split('?')[0] ?? url;

export async function buildMockApi(config: MockApiConfig) {
  let db = new Db(config.seed);
  const getDb = () => db;
  const sessions = new Sessions(config.sessionTtlS);
  const hub = new Hub(getDb, sessions, config.heartbeatMs * config.timeScale);
  const runner = new TaskRunner(getDb, hub, config);
  const permissions = loadOperationPermissions();
  const rumHits = new Map<string, number[]>();

  // trustProxy: only the gateway on this machine may set X-Forwarded-For (D2-08).
  const app = Fastify({ logger: false, trustProxy: '127.0.0.1' });
  await app.register(websocket);
  app.addHook('onClose', async () => {
    runner.stop();
    hub.stop();
  });

  // ── Hooks: latency, CSRF + Origin ──
  app.addHook('onRequest', async (req, reply) => {
    const path = pathOf(req.url);
    if (!path.startsWith('/api/') || path.startsWith(TEST_PREFIX)) return;
    if (config.latencyMs > 0) await sleep(config.latencyMs);
    if (!MUTATING.has(req.method)) return;
    const origin = req.headers.origin;
    if (!origin || !config.appOrigins.includes(origin)) return sendProblem(reply, 403, 'FORBIDDEN', { detail: 'Origin not allowed' });
    if (path !== '/api/rum' && req.headers['x-nimbus-csrf'] !== '1') return sendProblem(reply, 403, 'FORBIDDEN', { detail: 'Missing X-Nimbus-Csrf' });
  });

  app.setErrorHandler((error: { statusCode?: number }, _req, reply) => {
    if (error.statusCode === 413) return sendProblem(reply, 413, 'VALIDATION_FAILED', { detail: 'Body too large' });
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) return sendProblem(reply, 422, 'VALIDATION_FAILED');
    return sendProblem(reply, 500, 'INTERNAL');
  });
  app.setNotFoundHandler((_req, reply) => sendProblem(reply, 404, 'NOT_FOUND'));

  // ── Helpers ──
  /** preHandler: session (401) and x-permission (403) for an operation. */
  const guard = (operationId: string) => async (req: FastifyRequest, reply: FastifyReply) => {
    if (NO_AUTH.has(operationId)) return;
    const session = sessions.get(tokenFromCookie(req.headers.cookie));
    if (!session) return sendProblem(reply, 401, 'UNAUTHENTICATED');
    req.session = session;
    const needed = permissions.get(operationId);
    if (needed && !PERMISSIONS[session.user.role].includes(needed)) return sendProblem(reply, 403, 'FORBIDDEN');
  };
  const userOf = (req: FastifyRequest) => (req.session as Session).user;

  function parse<T>(schema: ZodType<T>, data: unknown, reply: FastifyReply): T | undefined {
    const result = schema.safeParse(data);
    if (result.success) return result.data;
    sendProblem(reply, 422, 'VALIDATION_FAILED', { errors: fieldErrors(result.error) });
    return undefined;
  }
  const query = (req: FastifyRequest) => {
    const q = { ...(req.query as Record<string, string>) } as Record<string, unknown>;
    if (typeof q.limit === 'string') q.limit = Number(q.limit); // the only numeric query parameter
    return q;
  };
  function paginate<T>(items: T[], limit: number, cursor: string | undefined, reply: FastifyReply) {
    let offset = 0;
    if (cursor) {
      offset = Number(Buffer.from(cursor, 'base64url').toString());
      const roundTrips = Buffer.from(String(offset)).toString('base64url') === cursor;
      if (!roundTrips || !Number.isInteger(offset) || offset < 0) {
        sendProblem(reply, 422, 'VALIDATION_FAILED', { errors: [{ field: 'cursor', message: 'Invalid cursor' }] });
        return undefined;
      }
    }
    const next = offset + limit < items.length ? Buffer.from(String(offset + limit)).toString('base64url') : null;
    return { items: items.slice(offset, offset + limit), nextCursor: next, total: items.length };
  }
  const tenantFor = (user: DemoUser, id: string) => {
    const t = db.tenants.get(id);
    return inScope(user, t) ? t : undefined;
  };
  /** listVms / listBuckets: tenant roles → own tenant; admins must pass an in-scope tenantId (D11). */
  function scopedTenant(user: DemoUser, tenantId: string | undefined, reply: FastifyReply): Tenant | undefined {
    if (isTenantRole(user)) {
      if (tenantId && tenantId !== user.tenantId) return void sendProblem(reply, 404, 'NOT_FOUND');
      return db.tenants.get(user.tenantId as string);
    }
    if (!tenantId) return void sendProblem(reply, 422, 'VALIDATION_FAILED', { errors: [{ field: 'tenantId', message: 'tenantId is required' }] });
    const t = tenantFor(user, tenantId);
    if (!t) return void sendProblem(reply, 404, 'NOT_FOUND');
    return t;
  }
  const quotasOf = (t: Tenant): TenantQuotas => {
    const plan = planById(t.planId);
    return {
      storageQuotaBytes: t.storageQuotaBytes, storageUsedBytes: t.storageUsedBytes, vmQuota: t.vmQuota, vmCount: t.vmCount,
      planMaxStorageQuotaBytes: plan?.maxStorageQuotaBytes ?? 0, planMaxVmQuota: plan?.maxVmQuota ?? 0,
    };
  };
  const meOf = (user: DemoUser): Me => {
    const t = user.tenantId ? db.tenants.get(user.tenantId) : undefined;
    return {
      user: { id: user.id, name: user.name, email: user.email },
      role: user.role,
      tenant: t ? { id: t.id, displayName: t.displayName, planName: planById(t.planId)?.name ?? '', status: t.status } : null,
      resellerId: user.resellerId,
      permissions: PERMISSIONS[user.role],
    };
  };
  const publishTenant = (t: Tenant) => hub.publish({ type: 'tenant.updated', tenant: { id: t.id, status: t.status } }, t.id);
  const publishQuota = (t: Tenant) => hub.publish({ type: 'quota.updated', tenantId: t.id, quotas: quotasOf(t) }, t.id);
  const publishVm = (vm: Vm) =>
    hub.publish({ type: 'vm.updated', vm: { id: vm.id, status: vm.status, ip: vm.ip, activeTaskId: vm.activeTaskId } }, vm.tenantId);

  // ── Auth ──
  app.post('/api/login', { preHandler: guard('login') }, async (req, reply) => {
    const body = parse(Z.LoginBody, req.body, reply);
    if (!body) return;
    const session = sessions.create(body.role);
    return reply.header('set-cookie', sessions.setCookie(session)).send(meOf(session.user));
  });
  app.post('/api/logout', { preHandler: guard('logout') }, async (req, reply) => {
    const session = req.session as Session;
    sessions.remove(session.token);
    hub.closeSessions((s) => s.token === session.token, CLOSE.sessionEnded, 'signed out');
    return reply.code(204).header('set-cookie', sessions.clearCookie()).send();
  });
  app.get('/api/me', { preHandler: guard('getMe') }, async (req) => meOf(userOf(req)));

  // ── Plans ──
  app.get('/api/plans', { preHandler: guard('listPlans') }, async () => PLANS);

  // ── Tenants ──
  app.get('/api/tenants', { preHandler: guard('listTenants') }, async (req, reply) => {
    const q = parse(Z.ListTenantsQueryParams, query(req), reply);
    if (!q) return;
    const user = userOf(req);
    const needle = q.q?.toLowerCase();
    const items = db.tenantOrder
      .map((id) => db.tenants.get(id) as Tenant)
      .filter((t) => inScope(user, t))
      .filter((t) => !needle || t.name.includes(needle) || t.displayName.toLowerCase().includes(needle))
      .filter((t) => !q.status || t.status === q.status)
      .filter((t) => !q.planId || t.planId === q.planId);
    const sort = q.sort ?? 'name';
    const desc = sort.startsWith('-');
    const field = (desc ? sort.slice(1) : sort) as 'name' | 'createdAt' | 'storageUsedBytes';
    items.sort((a, b) => {
      const d = a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0;
      return desc ? -d : d;
    });
    return paginate(items, q.limit, q.cursor, reply);
  });

  app.post('/api/tenants', { preHandler: guard('createTenant') }, async (req, reply) => {
    const body = parse(Z.CreateTenantBody, req.body, reply);
    if (!body) return;
    const user = userOf(req);
    if ([...db.tenants.values()].some((t) => t.name === body.name)) return sendProblem(reply, 409, 'TENANT_NAME_TAKEN');
    const plan = planById(body.planId);
    if (!plan) return sendProblem(reply, 422, 'VALIDATION_FAILED', { errors: [{ field: 'planId', message: 'Unknown plan' }] });
    if (body.storageQuotaBytes > plan.maxStorageQuotaBytes)
      return sendProblem(reply, 422, 'QUOTA_EXCEEDS_PLAN', { params: { resource: 'storage', plan: plan.name, max: plan.maxStorageQuotaBytes } });
    if (body.vmQuota > plan.maxVmQuota)
      return sendProblem(reply, 422, 'QUOTA_EXCEEDS_PLAN', { params: { resource: 'vms', plan: plan.name, max: plan.maxVmQuota } });
    let id: string;
    do id = `t_${Math.random().toString(36).slice(2, 7).padEnd(5, '0')}`;
    while (db.tenants.has(id));
    const tenant: Tenant = {
      id, name: body.name, displayName: body.displayName ?? body.name, status: 'provisioning', planId: plan.id,
      resellerId: user.role === 'reseller_admin' ? user.resellerId : null, adminEmail: body.adminEmail,
      createdAt: new Date().toISOString(), storageUsedBytes: 0, storageQuotaBytes: body.storageQuotaBytes, vmCount: 0, vmQuota: body.vmQuota,
    };
    db.addTenant(tenant);
    const task = runner.start('tenant.provision', { type: 'tenant', id, name: tenant.name }, id, {
      onSuccess: () => {
        tenant.status = 'active';
        publishTenant(tenant);
      },
    });
    return reply.code(201).send({ tenant, task });
  });

  const withTenant = (operationId: string, handler: (t: Tenant, req: FastifyRequest, reply: FastifyReply) => unknown) => ({
    preHandler: guard(operationId),
    handler: async (req: FastifyRequest, reply: FastifyReply) => {
      const params = parse(Z.GetTenantParams, req.params, reply);
      if (!params) return;
      const t = tenantFor(userOf(req), params.tenantId);
      if (!t) return sendProblem(reply, 404, 'NOT_FOUND');
      return handler(t, req, reply);
    },
  });

  app.get('/api/tenants/:tenantId', withTenant('getTenant', (t) => t));

  app.patch('/api/tenants/:tenantId', withTenant('updateTenant', (t, req, reply) => {
    const body = parse(Z.UpdateTenantBody, req.body, reply);
    if (!body) return;
    if (body.planId && body.planId !== t.planId) {
      const plan = planById(body.planId);
      if (!plan) return sendProblem(reply, 422, 'VALIDATION_FAILED', { errors: [{ field: 'planId', message: 'Unknown plan' }] });
      if (t.storageQuotaBytes > plan.maxStorageQuotaBytes)
        return sendProblem(reply, 422, 'QUOTA_EXCEEDS_PLAN', { params: { resource: 'storage', plan: plan.name, max: plan.maxStorageQuotaBytes } });
      if (t.vmQuota > plan.maxVmQuota) return sendProblem(reply, 422, 'QUOTA_EXCEEDS_PLAN', { params: { resource: 'vms', plan: plan.name, max: plan.maxVmQuota } });
      t.planId = plan.id;
      publishQuota(t);
    }
    if (body.displayName !== undefined) t.displayName = body.displayName;
    if (body.adminEmail !== undefined) t.adminEmail = body.adminEmail;
    return t;
  }));

  const lifecycle = (kind: 'tenant.suspend' | 'tenant.resume') => (t: Tenant, _req: FastifyRequest, reply: FastifyReply) => {
    if (kind === 'tenant.suspend' && t.status !== 'active') return sendProblem(reply, 409, 'TENANT_NOT_ACTIVE');
    if (kind === 'tenant.resume' && t.status !== 'suspended') return sendProblem(reply, 409, 'TENANT_NOT_SUSPENDED');
    const task = runner.start(kind, { type: 'tenant', id: t.id, name: t.name }, t.id, {
      onSuccess: () => {
        t.status = kind === 'tenant.suspend' ? 'suspended' : 'active';
        publishTenant(t);
      },
      onFailure: () => publishTenant(t),
    });
    return reply.code(202).send(task);
  };
  app.post('/api/tenants/:tenantId/suspend', withTenant('suspendTenant', lifecycle('tenant.suspend')));
  app.post('/api/tenants/:tenantId/resume', withTenant('resumeTenant', lifecycle('tenant.resume')));

  app.get('/api/tenants/:tenantId/quotas', withTenant('getQuotas', (t) => quotasOf(t)));
  app.put('/api/tenants/:tenantId/quotas', withTenant('updateQuotas', (t, req, reply) => {
    const body = parse(Z.UpdateQuotasBody, req.body, reply);
    if (!body) return;
    if (t.status === 'suspended') return sendProblem(reply, 409, 'TENANT_SUSPENDED');
    const plan = planById(t.planId);
    if (body.storageQuotaBytes !== undefined) {
      if (body.storageQuotaBytes < t.storageUsedBytes)
        return sendProblem(reply, 422, 'QUOTA_BELOW_USAGE', { params: { resource: 'storage', used: t.storageUsedBytes } });
      if (plan && body.storageQuotaBytes > plan.maxStorageQuotaBytes)
        return sendProblem(reply, 422, 'QUOTA_EXCEEDS_PLAN', { params: { resource: 'storage', plan: plan.name, max: plan.maxStorageQuotaBytes } });
    }
    if (body.vmQuota !== undefined) {
      if (body.vmQuota < t.vmCount) return sendProblem(reply, 422, 'QUOTA_BELOW_USAGE', { params: { resource: 'vms', used: t.vmCount } });
      if (plan && body.vmQuota > plan.maxVmQuota)
        return sendProblem(reply, 422, 'QUOTA_EXCEEDS_PLAN', { params: { resource: 'vms', plan: plan.name, max: plan.maxVmQuota } });
    }
    if (body.storageQuotaBytes !== undefined) t.storageQuotaBytes = body.storageQuotaBytes;
    if (body.vmQuota !== undefined) t.vmQuota = body.vmQuota;
    publishQuota(t);
    return quotasOf(t);
  }));

  // ── Compute ──
  app.get('/api/vms', { preHandler: guard('listVms') }, async (req, reply) => {
    const q = parse(Z.ListVmsQueryParams, query(req), reply);
    if (!q) return;
    const t = scopedTenant(userOf(req), q.tenantId, reply);
    if (!t) return;
    const needle = q.q?.toLowerCase();
    const items = db
      .vmsOf(t.id)
      .filter((vm) => (!q.status || vm.status === q.status) && (!needle || vm.name.includes(needle)))
      .sort((a, b) => a.name.localeCompare(b.name));
    return paginate(items, q.limit, q.cursor, reply);
  });

  const withVm = (operationId: string, handler: (vm: Vm, t: Tenant, req: FastifyRequest, reply: FastifyReply) => unknown) => ({
    preHandler: guard(operationId),
    handler: async (req: FastifyRequest, reply: FastifyReply) => {
      const params = parse(Z.GetVmParams, req.params, reply);
      if (!params) return;
      const vm = db.vm(params.vmId);
      const t = vm ? tenantFor(userOf(req), vm.tenantId) : undefined;
      if (!vm || !t) return sendProblem(reply, 404, 'NOT_FOUND');
      return handler(vm, t, req, reply);
    },
  });

  app.get('/api/vms/:vmId', withVm('getVm', (vm) => vm));

  const TRANSITIONS: Record<VmAction, { from: Vm['status']; during: Vm['status']; to: Vm['status'] }> = {
    start: { from: 'stopped', during: 'starting', to: 'running' },
    stop: { from: 'running', during: 'stopping', to: 'stopped' },
    reboot: { from: 'running', during: 'rebooting', to: 'running' },
  };
  app.post('/api/vms/:vmId/actions', withVm('runVmAction', (vm, t, req, reply) => {
    const body = parse(Z.RunVmActionBody, req.body, reply);
    if (!body) return;
    if (t.status === 'suspended') return sendProblem(reply, 409, 'TENANT_SUSPENDED');
    if (vm.activeTaskId) return sendProblem(reply, 409, 'VM_BUSY', { params: { name: vm.name } });
    const step = TRANSITIONS[body.action];
    if (vm.status !== step.from)
      return sendProblem(reply, 409, 'VM_INVALID_STATE', { params: { name: vm.name, action: body.action, status: vm.status } });
    const previous = vm.status;
    const task: Task = runner.start(`vm.${body.action}`, { type: 'vm', id: vm.id, name: vm.name }, vm.tenantId, {
      onSuccess: () => {
        Object.assign(vm, { status: step.to, activeTaskId: null, ip: step.to === 'running' ? vm.ip ?? `10.0.${Math.floor(Math.random() * 255)}.${1 + Math.floor(Math.random() * 253)}` : null });
        publishVm(vm);
      },
      onFailure: () => {
        Object.assign(vm, { status: previous, activeTaskId: null });
        publishVm(vm);
      },
    });
    Object.assign(vm, { status: step.during, activeTaskId: task.id });
    publishVm(vm);
    return reply.code(202).send(task);
  }));

  // ── Storage ──
  app.get('/api/buckets', { preHandler: guard('listBuckets') }, async (req, reply) => {
    const q = parse(Z.ListBucketsQueryParams, query(req), reply);
    if (!q) return;
    const t = scopedTenant(userOf(req), q.tenantId, reply);
    if (!t) return;
    const needle = q.q?.toLowerCase();
    const items = [...db.buckets.values()]
      .filter((b) => b.tenantId === t.id && (!needle || b.name.includes(needle)))
      .sort((a, b) => a.name.localeCompare(b.name));
    return paginate(items, q.limit, q.cursor, reply);
  });

  app.post('/api/buckets', { preHandler: guard('createBucket') }, async (req, reply) => {
    const body = parse(Z.CreateBucketBody, req.body, reply);
    if (!body) return;
    const t = db.tenants.get(userOf(req).tenantId ?? '');
    if (!t) return sendProblem(reply, 403, 'FORBIDDEN');
    if (body.name.includes('..') || /^\d{1,3}(\.\d{1,3}){3}$/.test(body.name))
      return sendProblem(reply, 422, 'VALIDATION_FAILED', { errors: [{ field: 'name', message: 'Invalid bucket name' }] });
    if (t.status === 'suspended') return sendProblem(reply, 409, 'TENANT_SUSPENDED');
    if (db.buckets.has(body.name)) return sendProblem(reply, 409, 'BUCKET_NAME_TAKEN');
    if (t.storageUsedBytes >= t.storageQuotaBytes) return sendProblem(reply, 422, 'QUOTA_EXCEEDED');
    const bucket = { name: body.name, tenantId: t.id, createdAt: new Date().toISOString(), sizeBytes: 0, objectCount: 0, versioning: body.versioning };
    db.buckets.set(bucket.name, bucket);
    hub.publish({ type: 'bucket.updated', tenantId: t.id, bucket, name: bucket.name }, t.id);
    publishQuota(t);
    return reply.code(201).send(bucket);
  });

  app.delete('/api/buckets/:bucketName', { preHandler: guard('deleteBucket') }, async (req, reply) => {
    const params = parse(Z.DeleteBucketParams, req.params, reply);
    if (!params) return;
    const bucket = db.buckets.get(params.bucketName);
    const t = bucket ? tenantFor(userOf(req), bucket.tenantId) : undefined;
    if (!bucket || !t) return sendProblem(reply, 404, 'NOT_FOUND');
    if (t.status === 'suspended') return sendProblem(reply, 409, 'TENANT_SUSPENDED');
    if (bucket.objectCount > 0) return sendProblem(reply, 409, 'BUCKET_NOT_EMPTY');
    db.buckets.delete(bucket.name);
    t.storageUsedBytes = Math.max(0, t.storageUsedBytes - bucket.sizeBytes);
    hub.publish({ type: 'bucket.updated', tenantId: t.id, bucket: null, name: bucket.name }, t.id);
    publishQuota(t);
    return reply.code(204).send();
  });

  // ── Tasks (scoped like events, D2-07) ──
  const visibleTask = (user: DemoUser, task: Task) =>
    task.tenantId === null ? user.role === 'provider_admin' : inScope(user, db.tenants.get(task.tenantId));
  app.get('/api/tasks', { preHandler: guard('listTasks') }, async (req, reply) => {
    const q = parse(Z.ListTasksQueryParams, query(req), reply);
    if (!q) return;
    const user = userOf(req);
    const cutoff = Date.now() - 24 * 3600 * 1000;
    for (const [id, task] of db.tasks) if (Date.parse(task.createdAt) < cutoff) db.tasks.delete(id); // kept 24 h
    const since = q.since ? Date.parse(q.since) : undefined;
    const items = [...db.tasks.values()]
      .filter((task) => visibleTask(user, task))
      .filter((task) => (!q.status || task.status === q.status) && (!q.resourceId || task.resource.id === q.resourceId))
      .filter((task) => since === undefined || Date.parse(task.createdAt) > since)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return paginate(items, q.limit, q.cursor, reply);
  });
  app.get('/api/tasks/:taskId', { preHandler: guard('getTask') }, async (req, reply) => {
    const params = parse(Z.GetTaskParams, req.params, reply);
    if (!params) return;
    const task = db.tasks.get(params.taskId);
    if (!task || !visibleTask(userOf(req), task)) return sendProblem(reply, 404, 'NOT_FOUND');
    return task;
  });

  // ── Realtime ──
  app.get('/api/events', { websocket: true, preValidation: guard('events') }, (socket, req) => {
    const origin = req.headers.origin;
    if (!origin || !config.appOrigins.includes(origin)) return socket.close(CLOSE.originRejected, 'origin rejected');
    hub.add(socket, req.session as Session);
  });

  // ── RUM ──
  app.post('/api/rum', { bodyLimit: 16 * 1024 }, async (req, reply) => {
    const now = Date.now();
    const hits = (rumHits.get(req.ip) ?? []).filter((t) => t > now - 60_000);
    if (hits.length >= RUM_LIMIT_PER_MINUTE) return sendProblem(reply, 429, 'RATE_LIMITED');
    rumHits.set(req.ip, [...hits, now]);
    const body = parse(Z.ReportVitalsBody, req.body, reply);
    if (!body) return;
    for (const record of body) db.vitals.push({ ...record, receivedAt: now });
    return reply.code(204).send();
  });
  app.get('/api/rum/summary', { preHandler: guard('getVitalsSummary') }, async () => {
    const cutoff = Date.now() - 24 * 3600 * 1000;
    const groups = new Map<string, number[]>();
    for (const v of db.vitals.filter((r) => r.receivedAt >= cutoff)) {
      const key = `${v.route}\u0000${v.metric}`;
      groups.set(key, [...(groups.get(key) ?? []), v.value]);
    }
    return [...groups].map(([key, values]): VitalSummary => {
      const [route, metric] = key.split('\u0000') as [string, VitalSummary['metric']];
      const sorted = values.sort((a, b) => a - b);
      const p75 = sorted[Math.max(0, Math.ceil(sorted.length * 0.75) - 1)] as number;
      const [good, poor] = VITAL_THRESHOLDS[metric] ?? [Infinity, Infinity];
      return { route, metric, p75, rating: p75 <= good ? 'good' : p75 <= poor ? 'needs-improvement' : 'poor', samples: sorted.length };
    });
  });

  // ── Test endpoints: only when NIMBUS_MODE is dev or e2e (specs/mock-data.md §8) ──
  if (config.testEndpoints) {
    const callerToken = (req: FastifyRequest) => sessions.get(tokenFromCookie(req.headers.cookie))?.token;
    const wantsAll = (req: FastifyRequest) => (req.body as { all?: unknown } | undefined)?.all === true;

    app.post('/api/__test/reset', async (_req, reply) => {
      runner.stop();
      db = new Db(config.seed);
      return reply.code(204).send();
    });
    app.post('/api/__test/emit', async (req, reply) => {
      const event = parse(Z.EventsResponse, req.body, reply) as ServerEvent | undefined;
      if (!event) return;
      const tenantId =
        event.type === 'task.updated' ? event.task.tenantId
        : event.type === 'vm.updated' ? (db.vm(event.vm.id)?.tenantId ?? null)
        : event.type === 'tenant.updated' ? event.tenant.id
        : event.type === 'quota.updated' || event.type === 'bucket.updated' ? event.tenantId
        : null;
      hub.publish(event, tenantId);
      return reply.code(204).send();
    });
    app.post('/api/__test/expire-session', async (req, reply) => {
      const all = wantsAll(req);
      const token = callerToken(req);
      const targets = all ? sessions.all().map((s) => s.token) : token ? [token] : [];
      for (const t of targets) sessions.remove(t);
      hub.closeSessions((s) => all || targets.includes(s.token), CLOSE.sessionEnded, 'session expired');
      return reply.code(204).send();
    });
    app.post('/api/__test/drop-sockets', async (req, reply) => {
      const all = wantsAll(req);
      const token = callerToken(req);
      hub.closeSessions((s) => all || s.token === token, CLOSE.goingAway, 'dropped by test');
      return reply.code(204).send();
    });
    app.post('/api/__test/fail-next-task', async (req, reply) => {
      const body = req.body as { kind?: TaskKind; code?: ErrorCode } | undefined;
      if (!body?.kind || !TASK_KINDS.includes(body.kind) || !body.code || !ERROR_CODES.includes(body.code))
        return sendProblem(reply, 422, 'VALIDATION_FAILED', { errors: [{ field: 'kind', message: 'kind and code required' }] });
      runner.failNextTask(body.kind, body.code);
      return reply.code(204).send();
    });
    app.post('/api/__test/set-usage', async (req, reply) => {
      const body = req.body as { tenantId?: string; usedBytes?: number } | undefined;
      const t = body?.tenantId ? db.tenants.get(body.tenantId) : undefined;
      if (!t || typeof body?.usedBytes !== 'number' || body.usedBytes < 0)
        return sendProblem(reply, 422, 'VALIDATION_FAILED', { errors: [{ field: 'usedBytes', message: 'tenantId and usedBytes required' }] });
      t.storageUsedBytes = body.usedBytes;
      publishQuota(t);
      return reply.code(204).send();
    });
  }

  app.decorate('mock', { hub, sessions, runner, db: getDb });
  return app;
}

export type MockApi = FastifyInstance;
