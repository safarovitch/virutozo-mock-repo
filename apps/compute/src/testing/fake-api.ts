// An in-memory API for component tests and stories (never imported by app code). It serves the compute
// operations the area uses with the server's rules (tenant scoping, VM_BUSY, VM_INVALID_STATE,
// TENANT_SUSPENDED), and records every request so tests can count them (AC-CMP-1.3, AC-CMP-1.5).
import type { Problem, Task, Tenant, Vm, VmAction } from '@nimbus/api-client/model';

const NAMES = [
  ...Array.from({ length: 12 }, (_, i) => `web-${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 4 }, (_, i) => `db-${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 20 }, (_, i) => `worker-${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 4 }, (_, i) => `cache-${String(i + 1).padStart(2, '0')}`),
];
const IMAGES = ['ubuntu-24.04', 'debian-13', 'rocky-10', 'windows-2025'];

/** acme's 40 VMs as in mock-data §5: every 4th is stopped, cache-04 is in error, the rest run. */
export function makeVms(count = 40, tenantId = 't_acme'): Vm[] {
  return NAMES.slice(0, count).map((name, i) => {
    const status: Vm['status'] = name === 'cache-04' ? 'error' : i % 4 === 3 ? 'stopped' : 'running';
    return {
      id: `vm_${String(i + 1).padStart(2, '0')}`,
      tenantId,
      name,
      status,
      vcpus: 1 + (i % 16),
      memoryMiB: 1024 * (1 + (i % 8)),
      diskGiB: 20 + i * 10,
      ip: status === 'running' ? `10.0.0.${i + 1}` : null,
      image: IMAGES[i % IMAGES.length] as string,
      activeTaskId: null,
      createdAt: new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString(),
    };
  });
}

export const ACME: Tenant = {
  id: 't_acme',
  name: 'acme',
  displayName: 'Acme Corporation',
  status: 'active',
  planId: 'p_business',
  resellerId: 'r_northwind',
  adminEmail: 'tom@acme.test',
  createdAt: '2025-03-01T09:00:00.000Z',
  storageUsedBytes: 0,
  storageQuotaBytes: 0,
  vmCount: 40,
  vmQuota: 50,
};

type Op = 'listVms' | 'getVm' | 'runVmAction' | 'getTask' | 'listTasks' | 'getTenant';

export interface FakeApiOptions {
  vms?: Vm[];
  tasks?: Task[];
  tenants?: Tenant[];
  /** Fail an operation with this status and code. */
  fail?: Partial<Record<Op, { status: number; code: Problem['code']; params?: Problem['params'] }>>;
  /** Never answer these operations (loading states). */
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
  /** Requests to one path, e.g. `count('/api/vms')`. */
  count(path: string, method?: string): number;
  vms: Vm[];
  tasks: Task[];
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' } });
const problem = (status: number, code: Problem['code'], params?: Problem['params']) => json(status, { title: code, status, code, ...(params ? { params } : {}) });

const DURING: Record<VmAction, Vm['status']> = { start: 'starting', stop: 'stopping', reboot: 'rebooting' };
const FROM: Record<VmAction, Vm['status']> = { start: 'stopped', stop: 'running', reboot: 'running' };

export const task = (id: string, patch: Partial<Task> = {}): Task => ({
  id,
  kind: 'vm.reboot',
  status: 'running',
  progress: 40,
  seq: 1,
  resource: { type: 'vm', id: 'vm_01', name: 'web-01' },
  tenantId: 't_acme',
  error: null,
  createdAt: '2026-11-05T09:50:00.000Z',
  finishedAt: null,
  ...patch,
});

export function createFakeApi(options: FakeApiOptions = {}): FakeApi {
  const vms = (options.vms ?? makeVms()).map((vm) => ({ ...vm }));
  const tasks = (options.tasks ?? []).map((t) => ({ ...t }));
  const tenants = options.tenants ?? [ACME];
  const requests: FakeRequest[] = [];
  let nextTask = 1;

  const route = (name: Op, ok: () => Response): Promise<Response> => {
    if (options.hang?.includes(name)) return new Promise(() => undefined);
    const f = options.fail?.[name];
    return Promise.resolve(f ? problem(f.status, f.code, f.params) : ok());
  };

  const handle = (method: string, url: URL, body: unknown): Promise<Response> => {
    const path = url.pathname.replace(/^\/api/, '');
    if (method === 'GET' && path === '/vms')
      return route('listVms', () => {
        const tenantId = url.searchParams.get('tenantId') ?? 't_acme';
        if (!tenants.some((t) => t.id === tenantId)) return problem(404, 'NOT_FOUND');
        const items = vms.filter((vm) => vm.tenantId === tenantId).sort((a, b) => a.name.localeCompare(b.name));
        const limit = Number(url.searchParams.get('limit') ?? 50);
        const offset = Number(url.searchParams.get('cursor') ?? 0);
        return json(200, { items: items.slice(offset, offset + limit), nextCursor: offset + limit < items.length ? String(offset + limit) : null, total: items.length });
      });
    const action = path.match(/^\/vms\/([^/]+)\/actions$/);
    if (action && method === 'POST')
      return route('runVmAction', () => {
        const vm = vms.find((v) => v.id === action[1]);
        if (!vm) return problem(404, 'NOT_FOUND');
        const verb = (body as { action: VmAction }).action;
        if (tenants.find((t) => t.id === vm.tenantId)?.status === 'suspended') return problem(409, 'TENANT_SUSPENDED');
        if (vm.activeTaskId) return problem(409, 'VM_BUSY', { name: vm.name });
        if (vm.status !== FROM[verb]) return problem(409, 'VM_INVALID_STATE', { name: vm.name, action: verb, status: vm.status });
        const created = task(`task_new${nextTask++}`, { kind: `vm.${verb}`, status: 'queued', progress: 0, seq: 0, resource: { type: 'vm', id: vm.id, name: vm.name }, tenantId: vm.tenantId, createdAt: new Date().toISOString() });
        tasks.push(created);
        Object.assign(vm, { status: DURING[verb], activeTaskId: created.id });
        return json(202, created);
      });
    const one = path.match(/^\/vms\/([^/]+)$/);
    if (one && method === 'GET')
      return route('getVm', () => {
        const vm = vms.find((v) => v.id === one[1]);
        return vm ? json(200, vm) : problem(404, 'NOT_FOUND');
      });
    const oneTask = path.match(/^\/tasks\/([^/]+)$/);
    if (oneTask && method === 'GET')
      return route('getTask', () => {
        const found = tasks.find((t) => t.id === oneTask[1]);
        return found ? json(200, found) : problem(404, 'NOT_FOUND');
      });
    if (method === 'GET' && path === '/tasks')
      return route('listTasks', () => {
        const id = url.searchParams.get('resourceId');
        const items = tasks.filter((t) => !id || t.resource.id === id);
        return json(200, { items, nextCursor: null, total: items.length });
      });
    const tenant = path.match(/^\/tenants\/([^/]+)$/);
    if (tenant && method === 'GET')
      return route('getTenant', () => {
        const found = tenants.find((t) => t.id === tenant[1]);
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
    vms,
    tasks,
  };
}
