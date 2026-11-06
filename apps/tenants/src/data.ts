// The tenants area's server state (RT-4): its own QueryClient, keys only from Orval's helpers.
import { useEffect, useMemo } from 'react';
import { MutationCache, QueryClient, keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { ApiError, messageFor } from '@nimbus/api-client';
import type { ListTenantsParams, Plan, Problem, Task, TaskPage, Tenant, TenantCreate, TenantCreated, TenantPage, TenantQuotas, QuotaUpdate } from '@nimbus/api-client/model';
import {
  createTenant,
  getGetQuotasQueryKey,
  getGetTenantQueryKey,
  getListPlansQueryKey,
  getListTasksQueryKey,
  getListTenantsQueryKey,
  getQuotas,
  getTenant,
  listPlans,
  listTasks,
  listTenants,
  resumeTenant,
  suspendTenant,
  updateQuotas,
} from '@nimbus/api-client/react';
import type { ScopedBus } from '@nimbus/mf-contract';
import { mergeTask } from '@nimbus/realtime';
import { t } from './messages/en';

type TenantPages = InfiniteData<TenantPage, string | undefined>;

/**
 * One per mount (MF-2). A refused mutation (403) shows `errors.FORBIDDEN` through the shell's toasts
 * (AC-SHL-3.2, D3-14); the optimistic quota update rolls itself back (R21).
 */
export function createTenantsQueryClient(events: ScopedBus): QueryClient {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError(error) {
        if (error instanceof ApiError && error.status === 403) events.publish('toast:show', { kind: 'error', message: messageFor(error.problem) });
      },
    }),
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
}

/** The message for a failed request: the mapped `Problem.code`, never server text (MSG-3). */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? messageFor(error.problem) : t('errors.INTERNAL');
}
export const problemOf = (error: unknown): Problem | undefined => (error instanceof ApiError ? error.problem : undefined);

// ── Queries ──

export function useTenantList(params: ListTenantsParams) {
  return useInfiniteQuery({
    queryKey: getListTenantsQueryKey(params),
    queryFn: async ({ pageParam, signal }) => (await listTenants({ ...params, ...(pageParam ? { cursor: pageParam } : {}) }, { signal })).data as TenantPage,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData, // a filter change keeps rows on screen with the header progress bar
  });
}

export function usePlans() {
  const query = useQuery({ queryKey: getListPlansQueryKey(), queryFn: async ({ signal }) => (await listPlans({ signal })).data as Plan[], staleTime: Infinity });
  const byId = useMemo(() => new Map((query.data ?? []).map((p) => [p.id, p])), [query.data]);
  return { ...query, byId };
}

export function useTenant(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useQuery<Tenant>({
    queryKey: getGetTenantQueryKey(tenantId ?? ''),
    queryFn: async ({ signal }) => (await getTenant(tenantId as string, { signal })).data as Tenant,
    enabled: Boolean(tenantId),
    placeholderData: () => (tenantId ? findListedTenant(queryClient, tenantId) : undefined), // instant drawer from the list row
  });
}

export function useQuotas(tenantId: string) {
  return useQuery({ queryKey: getGetQuotasQueryKey(tenantId), queryFn: async ({ signal }) => (await getQuotas(tenantId, { signal })).data as TenantQuotas });
}

export const activityParams = (tenantId: string) => ({ resourceId: tenantId, limit: 50 });

export function useActivity(tenantId: string) {
  const queryClient = useQueryClient();
  const params = activityParams(tenantId);
  const queryKey = getListTasksQueryKey(params);
  return useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const res = (await listTasks(params, { signal })).data as TaskPage;
      return mergeTaskPage(queryClient.getQueryData<TaskPage>(queryKey), res.items); // never undo newer event data
    },
  });
}

// ── Cache helpers ──

const listKey = getListTenantsQueryKey(); // ['/tenants']: the prefix of every list query

function findListedTenant(queryClient: QueryClient, id: string): Tenant | undefined {
  for (const [, data] of queryClient.getQueriesData<TenantPages>({ queryKey: listKey })) {
    for (const page of data?.pages ?? []) {
      const hit = page.items.find((row) => row.id === id);
      if (hit) return hit;
    }
  }
  return undefined;
}

/** Patches one tenant in every list page and in its `getTenant` cache (D5-02: rows stay where they are). */
export function patchTenant(queryClient: QueryClient, id: string, patch: Partial<Tenant>): void {
  queryClient.setQueriesData<TenantPages>({ queryKey: listKey }, (data) =>
    data && { ...data, pages: data.pages.map((page) => (page.items.some((r) => r.id === id) ? { ...page, items: page.items.map((r) => (r.id === id ? { ...r, ...patch } : r)) } : page)) },
  );
  queryClient.setQueryData<Tenant>(getGetTenantQueryKey(id), (tenant) => tenant && { ...tenant, ...patch });
}

const quotaFields = (q: Pick<TenantQuotas, 'storageQuotaBytes' | 'storageUsedBytes' | 'vmQuota' | 'vmCount'>): Partial<Tenant> => ({
  storageQuotaBytes: q.storageQuotaBytes,
  storageUsedBytes: q.storageUsedBytes,
  vmQuota: q.vmQuota,
  vmCount: q.vmCount,
});

export function applyQuotas(queryClient: QueryClient, tenantId: string, quotas: TenantQuotas): void {
  patchTenant(queryClient, tenantId, quotaFields(quotas));
  queryClient.setQueryData(getGetQuotasQueryKey(tenantId), quotas);
}

export function mergeTaskPage(page: TaskPage | undefined, incoming: readonly Task[]): TaskPage {
  const byId = new Map((page?.items ?? []).map((task) => [task.id, task]));
  for (const task of incoming) byId.set(task.id, mergeTask(byId.get(task.id), task));
  const items = [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50);
  return { items, nextCursor: null, total: items.length };
}

// ── Mutations ──

/**
 * AC-TEN-3.3, D5-14: optimistic on the list rows and the quotas cache, rolled back on any error. The
 * server's answer (and `server:quota.updated`) replaces the guess.
 */
export function useUpdateQuotas(tenantId: string, events: ScopedBus) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: QuotaUpdate) => (await updateQuotas(tenantId, body)).data as TenantQuotas,
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: getGetQuotasQueryKey(tenantId) });
      const lists = queryClient.getQueriesData<TenantPages>({ queryKey: listKey });
      const tenant = queryClient.getQueryData<Tenant>(getGetTenantQueryKey(tenantId));
      const quotas = queryClient.getQueryData<TenantQuotas>(getGetQuotasQueryKey(tenantId));
      patchTenant(queryClient, tenantId, { ...(body.storageQuotaBytes !== undefined ? { storageQuotaBytes: body.storageQuotaBytes } : {}), ...(body.vmQuota !== undefined ? { vmQuota: body.vmQuota } : {}) });
      if (quotas) queryClient.setQueryData<TenantQuotas>(getGetQuotasQueryKey(tenantId), { ...quotas, ...body });
      return { lists, tenant, quotas };
    },
    onError: (_error, _body, snapshot) => {
      if (!snapshot) return;
      for (const [key, data] of snapshot.lists) queryClient.setQueryData(key, data);
      queryClient.setQueryData(getGetTenantQueryKey(tenantId), snapshot.tenant);
      queryClient.setQueryData(getGetQuotasQueryKey(tenantId), snapshot.quotas);
    },
    onSuccess: (quotas) => {
      applyQuotas(queryClient, tenantId, quotas);
      events.publish('toast:show', { kind: 'success', message: t('tenants.quotas.saved') });
    },
  });
}

/**
 * D7-04: a new tenant goes to the top of the first page of every cached list whose filters it matches,
 * whatever the sort, and that list's total goes up by 1. It moves to its sorted place on the next refetch.
 */
export function insertTenant(queryClient: QueryClient, tenant: Tenant): void {
  for (const [key, data] of queryClient.getQueriesData<TenantPages>({ queryKey: listKey })) {
    const params = (key[1] ?? {}) as ListTenantsParams;
    const q = params.q?.trim().toLowerCase();
    const matches =
      (!q || tenant.name.includes(q) || tenant.displayName.toLowerCase().includes(q)) &&
      (!params.status || params.status === tenant.status) &&
      (!params.planId || params.planId === tenant.planId);
    const [first, ...rest] = data?.pages ?? [];
    if (!matches || !data || !first || first.items.some((r) => r.id === tenant.id)) continue;
    queryClient.setQueryData<TenantPages>(key, {
      ...data,
      pages: [{ ...first, items: [tenant, ...first.items], total: first.total + 1 }, ...rest.map((page) => ({ ...page, total: page.total + 1 }))],
    });
  }
}

/** SPEC-TEN-2 submit: the caller maps errors to fields (D7-09); success is handled here (D7-11). */
export function useCreateTenant(events: ScopedBus) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: TenantCreate) => (await createTenant(body)).data as TenantCreated,
    onSuccess: ({ tenant, task }) => {
      insertTenant(queryClient, tenant);
      queryClient.setQueryData(getGetTenantQueryKey(tenant.id), tenant);
      events.publish('task:started', { task }); // AC-TEN-2.7
      events.publish('toast:show', { kind: 'success', message: t('tenants.toast.created', { name: tenant.name }), resource: { type: 'tenant', id: tenant.id } });
    },
  });
}

/**
 * SPEC-TEN-4: suspend or resume. The 202's task goes to the task center at once (AC-TEN-4.5) and to the
 * caller's `onStarted`. A stale row (409 TENANT_NOT_ACTIVE / TENANT_NOT_SUSPENDED) shows its message and
 * refetches that tenant, which patches the row (D7-14). 403s are toasted by the client's MutationCache.
 */
export function useTenantLifecycle(events: ScopedBus, onStarted: (task: Task) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, kind }: { tenantId: string; kind: 'suspend' | 'resume' }) =>
      (await (kind === 'suspend' ? suspendTenant(tenantId) : resumeTenant(tenantId))).data as Task,
    onSuccess: (task) => {
      onStarted(task);
      events.publish('task:started', { task });
    },
    onError: (error, { tenantId }) => {
      const problem = problemOf(error);
      if (problem?.status === 403) return;
      events.publish('toast:show', { kind: 'error', message: errorMessage(error) });
      if (problem?.code === 'TENANT_NOT_ACTIVE' || problem?.code === 'TENANT_NOT_SUSPENDED') {
        void queryClient
          .fetchQuery({ queryKey: getGetTenantQueryKey(tenantId), queryFn: async ({ signal }) => (await getTenant(tenantId, { signal })).data as Tenant, staleTime: 0 })
          .then((tenant) => patchTenant(queryClient, tenantId, { status: tenant.status }))
          .catch(() => undefined);
      }
    },
  });
}

// ── Server events (RT-3…RT-7) ──

type Update = () => void;

/**
 * Applies server events to this area's cache, batched per animation frame (RT-5), and invalidates its
 * own queries after a reconnect (RT-6). Returns a cleanup that also cancels a pending frame (RT-7).
 */
export function subscribeServerEvents(events: ScopedBus, queryClient: QueryClient): () => void {
  let queue: Update[] = [];
  let frame = 0;
  const enqueue = (update: Update) => {
    queue.push(update);
    frame ||= requestAnimationFrame(() => {
      frame = 0;
      const batch = queue;
      queue = [];
      for (const apply of batch) apply();
    });
  };
  const offs = [
    events.subscribe('server:tenant.updated', ({ tenant }) => enqueue(() => patchTenant(queryClient, tenant.id, { status: tenant.status }))),
    events.subscribe('server:quota.updated', ({ tenantId, quotas }) => enqueue(() => applyQuotas(queryClient, tenantId, quotas))),
    events.subscribe('server:task.updated', ({ task }) => {
      if (task.resource.type !== 'tenant') return;
      const key = getListTasksQueryKey(activityParams(task.resource.id));
      enqueue(() => {
        if (queryClient.getQueryData(key)) queryClient.setQueryData<TaskPage>(key, (page) => mergeTaskPage(page, [task]));
      });
    }),
    events.subscribe('realtime:reconnected', () => void queryClient.invalidateQueries()), // only this area's client
  ];
  return () => {
    offs.forEach((off) => off());
    cancelAnimationFrame(frame);
    queue = [];
  };
}

export function useServerEvents(events: ScopedBus): void {
  const queryClient = useQueryClient();
  useEffect(() => subscribeServerEvents(events, queryClient), [events, queryClient]);
}
