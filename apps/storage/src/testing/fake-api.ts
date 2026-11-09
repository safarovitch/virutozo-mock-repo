// An in-memory API for component tests and stories (never imported by app code). It serves the storage
// operations with the server's rules (scoping, name checks, quota, suspended tenants, non-empty buckets)
// and records every request so tests can count them.
import type { Bucket, Problem, Tenant, TenantQuotas } from '@nimbus/api-client/model';

export const GIB = 1024 ** 3;

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

const bucket = (name: string, gib: number, objects: number, versioning = false, tenantId = 't_acme'): Bucket => ({
  name,
  tenantId,
  createdAt: '2025-06-01T10:00:00.000Z',
  sizeBytes: gib * GIB,
  objectCount: objects,
  versioning,
});

/** A few of acme's seeded buckets (mock-data §6): `acme-scratch` is empty, `acme-backups` isn't. */
export const ACME_BUCKETS: Bucket[] = [
  bucket('acme-assets', 1, 1200, true),
  bucket('acme-backups', 80, 5400),
  bucket('acme-logs-2026', 9, 88_000),
  bucket('acme-scratch', 0, 0),
  bucket('acme-media', 1.5, 3100, true),
];

type Op = 'listBuckets' | 'createBucket' | 'deleteBucket' | 'getQuotas' | 'getTenant' | 'listTenants';

export interface FakeApiOptions {
  tenants?: Tenant[];
  buckets?: Bucket[];
  /** The tenant of a tenant-role session (listBuckets without tenantId, createBucket). */
  ownTenantId?: string;
  fail?: Partial<Record<Op, { status: number; code: Problem['code']; errors?: Problem['errors'] }>>;
  hang?: readonly Op[];
}

export interface FakeRequest {
  method: string;
  url: URL;
  body?: unknown;
}

export interface FakeApi {
  fetch: typeof fetch;
  requests: FakeRequest[];
  count(path: string, method?: string): number;
  /** Change these to simulate changes made elsewhere. */
  tenants: Tenant[];
  buckets: Bucket[];
}

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' } });
const problem = (status: number, code: Problem['code'], errors?: Problem['errors']) => json(status, { title: code, status, code, ...(errors ? { errors } : {}) });

export const quotasOf = (t: Tenant): TenantQuotas => ({
  storageQuotaBytes: t.storageQuotaBytes,
  storageUsedBytes: t.storageUsedBytes,
  vmQuota: t.vmQuota,
  vmCount: t.vmCount,
  planMaxStorageQuotaBytes: 1024 * GIB,
  planMaxVmQuota: 50,
});

export function createFakeApi(options: FakeApiOptions = {}): FakeApi {
  const tenants = (options.tenants ?? [ACME]).map((t) => ({ ...t }));
  const buckets = (options.buckets ?? ACME_BUCKETS).map((b) => ({ ...b }));
  const ownTenantId = options.ownTenantId ?? 't_acme';
  const requests: FakeRequest[] = [];

  const route = (name: Op, ok: () => Response): Promise<Response> => {
    if (options.hang?.includes(name)) return new Promise(() => undefined);
    const f = options.fail?.[name];
    return Promise.resolve(f ? problem(f.status, f.code, f.errors) : ok());
  };
  const tenantOf = (id: string | null) => tenants.find((t) => t.id === id);

  const handle = (method: string, url: URL, body: unknown): Promise<Response> => {
    const path = url.pathname.replace(/^\/api/, '');
    if (method === 'GET' && path === '/buckets')
      return route('listBuckets', () => {
        const tenant = tenantOf(url.searchParams.get('tenantId') ?? ownTenantId);
        if (!tenant) return problem(404, 'NOT_FOUND');
        const items = buckets.filter((b) => b.tenantId === tenant.id).sort((a, b) => a.name.localeCompare(b.name));
        const limit = Number(url.searchParams.get('limit') ?? 50);
        const offset = Number(url.searchParams.get('cursor') ?? 0);
        return json(200, { items: items.slice(offset, offset + limit), nextCursor: offset + limit < items.length ? String(offset + limit) : null, total: items.length });
      });
    if (method === 'POST' && path === '/buckets')
      return route('createBucket', () => {
        const tenant = tenantOf(ownTenantId) as Tenant;
        const { name, versioning = false } = body as { name: string; versioning?: boolean };
        if (tenant.status === 'suspended') return problem(409, 'TENANT_SUSPENDED');
        if (buckets.some((b) => b.name === name)) return problem(409, 'BUCKET_NAME_TAKEN');
        if (tenant.storageUsedBytes >= tenant.storageQuotaBytes) return problem(422, 'QUOTA_EXCEEDED');
        const created: Bucket = { name, tenantId: tenant.id, createdAt: '2026-11-06T10:00:00.000Z', sizeBytes: 0, objectCount: 0, versioning };
        buckets.push(created);
        return json(201, created);
      });
    const one = path.match(/^\/buckets\/([^/]+)$/);
    if (one && method === 'DELETE')
      return route('deleteBucket', () => {
        const found = buckets.find((b) => b.name === decodeURIComponent(one[1] as string));
        if (!found) return problem(404, 'NOT_FOUND');
        if (tenantOf(found.tenantId)?.status === 'suspended') return problem(409, 'TENANT_SUSPENDED');
        if (found.objectCount > 0) return problem(409, 'BUCKET_NOT_EMPTY');
        buckets.splice(buckets.indexOf(found), 1);
        return json(204);
      });
    const quotas = path.match(/^\/tenants\/([^/]+)\/quotas$/);
    if (quotas && method === 'GET')
      return route('getQuotas', () => {
        const tenant = tenantOf(quotas[1] as string);
        return tenant ? json(200, quotasOf(tenant)) : problem(404, 'NOT_FOUND');
      });
    if (method === 'GET' && path === '/tenants')
      return route('listTenants', () => {
        const q = (url.searchParams.get('q') ?? '').toLowerCase();
        const items = tenants.filter((t) => !q || t.name.includes(q) || t.displayName.toLowerCase().includes(q)).slice(0, Number(url.searchParams.get('limit') ?? 50));
        return json(200, { items, nextCursor: null, total: items.length });
      });
    const tenant = path.match(/^\/tenants\/([^/]+)$/);
    if (tenant && method === 'GET')
      return route('getTenant', () => {
        const found = tenantOf(tenant[1] as string);
        return found ? json(200, found) : problem(404, 'NOT_FOUND');
      });
    return Promise.resolve(problem(404, 'NOT_FOUND'));
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
    buckets,
  };
}
