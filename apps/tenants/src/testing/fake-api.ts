// An in-memory API for component tests and stories (never imported by app code). It serves the tenant
// operations the area uses, with the server's rules (search, filters, sort, cursor pages, quota checks),
// and records every request so tests can count them (AC-TEN-1.2, AC-TEN-1.6).
import type { Plan, Problem, Task, Tenant, TenantQuotas } from '@nimbus/api-client/model';

const GIB = 1024 ** 3;

export const PLANS: Plan[] = [
  { id: 'p_starter', name: 'Starter', maxStorageQuotaBytes: 100 * GIB, maxVmQuota: 10, defaultStorageQuotaBytes: 50 * GIB, defaultVmQuota: 5, pricePerGiBMonth: { amountMicros: 40_000, currency: 'EUR' }, pricePerVcpuMonth: { amountMicros: 6_000_000, currency: 'EUR' } },
  { id: 'p_business', name: 'Business', maxStorageQuotaBytes: 1024 * GIB, maxVmQuota: 50, defaultStorageQuotaBytes: 250 * GIB, defaultVmQuota: 20, pricePerGiBMonth: { amountMicros: 35_000, currency: 'EUR' }, pricePerVcpuMonth: { amountMicros: 5_500_000, currency: 'EUR' } },
];

export const ACME: Tenant = {
  id: 't_acme',
  name: 'acme',
  displayName: 'Acme Corporation',
  status: 'active',
  planId: 'p_business',
  resellerId: 'r_northwind',
  adminEmail: 'tom@acme.test',
  createdAt: '2025-03-01T09:00:00.000Z',
  storageUsedBytes: 205 * GIB,
  storageQuotaBytes: 250 * GIB,
  vmCount: 40,
  vmQuota: 50,
};

const STATUSES = ['active', 'active', 'active', 'suspended', 'provisioning', 'error'] as const;

/** `count` tenants: acme plus generated ones, deterministic. */
export function makeTenants(count: number): Tenant[] {
  const rows: Tenant[] = [ACME];
  for (let i = 1; i < count; i++) {
    const n = String(i).padStart(5, '0');
    rows.push({
      id: `t_${n}`,
      name: `tenant-${n}`,
      displayName: `Tenant ${n}`,
      status: STATUSES[i % STATUSES.length] as Tenant['status'],
      planId: i % 2 ? 'p_starter' : 'p_business',
      resellerId: null,
      adminEmail: `admin@tenant-${n}.test`,
      createdAt: new Date(Date.UTC(2024, 0, 1) + i * 3_600_000).toISOString(),
      storageUsedBytes: (i % 50) * GIB,
      storageQuotaBytes: 100 * GIB,
      vmCount: i % 10,
      vmQuota: 10,
    });
  }
  return rows;
}

type Operation = 'listTenants' | 'listPlans' | 'getTenant' | 'getQuotas' | 'updateQuotas' | 'listTasks' | 'createTenant' | 'suspendTenant' | 'resumeTenant';

export interface FakeApiOptions {
  tenants?: Tenant[];
  tasks?: Task[];
  /** Fail an operation with this status and code. */
  fail?: Partial<Record<Operation, { status: number; code: Problem['code']; params?: Problem['params']; errors?: Problem['errors'] }>>;
  /** Never answer these operations (loading and pending states). */
  hang?: ReadonlyArray<Operation>;
}

export interface FakeRequest {
  method: string;
  url: URL;
  body?: unknown;
}

export interface FakeApi {
  fetch: typeof fetch;
  requests: FakeRequest[];
  /** Requests to one path, e.g. `count('/api/tenants')`. */
  count(path: string, method?: string): number;
  tenants: Tenant[];
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' } });
const problem = (status: number, code: Problem['code'], params?: Problem['params'], errors?: Problem['errors']) =>
  json(status, { title: code, status, code, ...(params ? { params } : {}), ...(errors ? { errors } : {}) });

export function quotasOf(tenant: Tenant): TenantQuotas {
  const plan = PLANS.find((p) => p.id === tenant.planId) ?? (PLANS[1] as Plan);
  return {
    storageQuotaBytes: tenant.storageQuotaBytes,
    storageUsedBytes: tenant.storageUsedBytes,
    vmQuota: tenant.vmQuota,
    vmCount: tenant.vmCount,
    planMaxStorageQuotaBytes: plan.maxStorageQuotaBytes,
    planMaxVmQuota: plan.maxVmQuota,
  };
}

export function createFakeApi(options: FakeApiOptions = {}): FakeApi {
  const tenants = (options.tenants ?? makeTenants(250)).map((t) => ({ ...t }));
  const tasks = options.tasks ?? [];
  const requests: FakeRequest[] = [];

  const handle = async (method: string, url: URL, body: unknown): Promise<Response> => {
    const path = url.pathname.replace(/^\/api/, '');
    const op = (name: Operation) => {
      if (options.hang?.includes(name)) return 'hang' as const;
      const f = options.fail?.[name];
      return f ? problem(f.status, f.code, f.params, f.errors) : null;
    };
    const route = (name: Operation, ok: () => Response): Promise<Response> => {
      const outcome = op(name);
      if (outcome === 'hang') return new Promise(() => undefined);
      return Promise.resolve(outcome ?? ok());
    };

    if (method === 'GET' && path === '/plans') return route('listPlans', () => json(200, PLANS));
    if (method === 'GET' && path === '/tenants')
      return route('listTenants', () => {
        const p = url.searchParams;
        const q = p.get('q')?.toLowerCase();
        const items = tenants
          .filter((t) => !q || t.name.includes(q) || t.displayName.toLowerCase().includes(q))
          .filter((t) => !p.get('status') || t.status === p.get('status'))
          .filter((t) => !p.get('planId') || t.planId === p.get('planId'));
        const sort = p.get('sort') ?? 'name';
        const desc = sort.startsWith('-');
        const field = (desc ? sort.slice(1) : sort) as 'name' | 'createdAt' | 'storageUsedBytes';
        items.sort((a, b) => (a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0) * (desc ? -1 : 1));
        const limit = Number(p.get('limit') ?? 50);
        const offset = Number(p.get('cursor') ?? 0);
        const page = items.slice(offset, offset + limit);
        return json(200, { items: page, nextCursor: offset + limit < items.length ? String(offset + limit) : null, total: items.length });
      });
    if (method === 'GET' && path === '/tasks')
      return route('listTasks', () => {
        const id = url.searchParams.get('resourceId');
        const items = tasks.filter((t) => !id || t.resource.id === id);
        return json(200, { items, nextCursor: null, total: items.length });
      });
    const quotas = path.match(/^\/tenants\/([^/]+)\/quotas$/);
    if (quotas) {
      const tenant = tenants.find((t) => t.id === quotas[1]);
      if (method === 'GET') return route('getQuotas', () => (tenant ? json(200, quotasOf(tenant)) : problem(404, 'NOT_FOUND')));
      if (method === 'PUT')
        return route('updateQuotas', () => {
          if (!tenant) return problem(404, 'NOT_FOUND');
          if (tenant.status === 'suspended') return problem(409, 'TENANT_SUSPENDED');
          const update = body as { storageQuotaBytes?: number; vmQuota?: number };
          if (update.storageQuotaBytes !== undefined && update.storageQuotaBytes < tenant.storageUsedBytes)
            return problem(422, 'QUOTA_BELOW_USAGE', { resource: 'storage', used: tenant.storageUsedBytes });
          Object.assign(tenant, update);
          return json(200, quotasOf(tenant));
        });
    }
    if (method === 'POST' && path === '/tenants')
      return route('createTenant', () => {
        const input = body as { name: string; displayName?: string; adminEmail: string; planId: string; storageQuotaBytes: number; vmQuota: number };
        if (tenants.some((t) => t.name === input.name)) return problem(409, 'TENANT_NAME_TAKEN');
        const tenant: Tenant = {
          id: `t_new${tenants.length}`,
          name: input.name,
          displayName: input.displayName ?? input.name,
          status: 'provisioning',
          planId: input.planId,
          resellerId: null,
          adminEmail: input.adminEmail,
          createdAt: '2026-11-05T12:00:00.000Z',
          storageUsedBytes: 0,
          storageQuotaBytes: input.storageQuotaBytes,
          vmCount: 0,
          vmQuota: input.vmQuota,
        };
        tenants.push(tenant);
        return json(201, { tenant, task: task(`task_p${tenants.length}`, { kind: 'tenant.provision', progress: 0, seq: 0, status: 'queued', resource: { type: 'tenant', id: tenant.id, name: tenant.name }, tenantId: tenant.id }) });
      });
    const lifecycle = path.match(/^\/tenants\/([^/]+)\/(suspend|resume)$/);
    if (lifecycle && method === 'POST') {
      const [, id, verb] = lifecycle;
      return route(verb === 'suspend' ? 'suspendTenant' : 'resumeTenant', () => {
        const tenant = tenants.find((t) => t.id === id);
        if (!tenant) return problem(404, 'NOT_FOUND');
        if (verb === 'suspend' && tenant.status !== 'active') return problem(409, 'TENANT_NOT_ACTIVE');
        if (verb === 'resume' && tenant.status !== 'suspended') return problem(409, 'TENANT_NOT_SUSPENDED');
        const kind = verb === 'suspend' ? 'tenant.suspend' : 'tenant.resume';
        return json(202, task(`task_${verb}_${tenant.id}`, { kind, progress: 0, seq: 0, status: 'queued', resource: { type: 'tenant', id: tenant.id, name: tenant.name }, tenantId: tenant.id }));
      });
    }
    const one = path.match(/^\/tenants\/([^/]+)$/);
    if (one && method === 'GET') return route('getTenant', () => {
      const tenant = tenants.find((t) => t.id === one[1]);
      return tenant ? json(200, tenant) : problem(404, 'NOT_FOUND');
    });
    return problem(404, 'NOT_FOUND');
  };

  const fakeFetch: typeof fetch = async (input, init) => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request ? request.url : String(input), 'http://localhost');
    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    requests.push({ method, url, body });
    return handle(method, url, body);
  };

  return {
    fetch: fakeFetch,
    requests,
    count: (path, method = 'GET') => requests.filter((r) => r.method === method && r.url.pathname === path).length,
    tenants,
  };
}

export const task = (id: string, patch: Partial<Task> = {}): Task => ({
  id,
  kind: 'tenant.suspend',
  status: 'running',
  progress: 40,
  seq: 1,
  resource: { type: 'tenant', id: 't_acme', name: 'acme' },
  tenantId: 't_acme',
  error: null,
  createdAt: '2026-11-01T11:50:00.000Z',
  finishedAt: null,
  ...patch,
});
