// The compute area's server state (RT-4): its own QueryClient, keys only from Orval's helpers.
// `getListVmsQueryKey()` (['vms']) is the prefix of both the list pages and every `getVm`, so one
// `setQueriesData` over it updates every cached copy of a VM.
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { QueryClient, useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/vue-query';
import { ApiError, messageFor } from '@nimbus/api-client';
import { getGetTaskQueryKey, getGetTenantQueryKey, getGetVmQueryKey, getListTasksQueryKey, getListVmsQueryKey, getTask, getTenant, getVm, listTasks, listVms, runVmAction } from '@nimbus/api-client/vue';
import type { ListVmsParams, Problem, Task, TaskPage, Tenant, Vm, VmAction, VmPage, VmStatus } from '@nimbus/api-client/model';
import type { BusEvents, ScopedBus } from '@nimbus/mf-contract';
import { mergeTask } from '@nimbus/realtime';
import { t } from './messages/en';

export type VmPages = InfiniteData<VmPage, string | undefined>;
export type VmPatch = Partial<Vm> & Pick<Vm, 'id'>;
type VmEvent = BusEvents['server:vm.updated']['vm'];

/** One page holds every VM of a Business tenant (D6-04); more pages load with *Load more*. */
export const PAGE_SIZE = 200;
export const RECENT_TASKS = 20;

/** The status a VM shows while an action runs (contract transitions, mock-data §7). */
export const DURING: Record<VmAction, VmStatus> = { start: 'starting', stop: 'stopping', reboot: 'rebooting' };
const TRANSITIONAL = new Set<VmStatus>(['starting', 'stopping', 'rebooting']);
export const isTransitional = (status: VmStatus) => TRANSITIONAL.has(status);

/** One per mount (MF-2). */
export function createComputeQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
}

/** The message for a failed request: the mapped `Problem.code`, never server text (MSG-3). */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? messageFor(error.problem) : t('errors.INTERNAL');
}
export const problemOf = (error: unknown): Problem | undefined => (error instanceof ApiError ? error.problem : undefined);

export const listParams = (tenantId: string | undefined): ListVmsParams => ({ ...(tenantId ? { tenantId } : {}), limit: PAGE_SIZE });
export const recentTasksParams = (vmId: string) => ({ resourceId: vmId, limit: RECENT_TASKS });

// ── Queries ──

/** `params` undefined: an admin without a tenant (nothing to list yet, SPEC-CMP-4). */
export function useVmList(params: MaybeRefOrGetter<ListVmsParams | undefined>) {
  return useInfiniteQuery({
    queryKey: computed(() => getListVmsQueryKey(toValue(params) ?? {})),
    queryFn: async ({ pageParam, signal }) => (await listVms({ ...toValue(params), ...(pageParam ? { cursor: pageParam } : {}) }, { signal })).data as VmPage,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: VmPage) => last.nextCursor ?? undefined,
    enabled: computed(() => toValue(params) !== undefined),
  });
}

export function useVm(vmId: MaybeRefOrGetter<string | undefined>) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: computed(() => getGetVmQueryKey(toValue(vmId) ?? '')),
    queryFn: async ({ signal }) => (await getVm(toValue(vmId) as string, { signal })).data as Vm,
    enabled: computed(() => Boolean(toValue(vmId))),
    placeholderData: () => findListedVm(queryClient, toValue(vmId) ?? ''), // instant drawer from the list row
  });
}

/**
 * The task behind a VM's `activeTaskId` (AC-CMP-1.5). Events keep it current (`mergeTask`), so it is
 * fetched once; a reconnect invalidates it like every other active query (RT-6).
 */
export function useTask(taskId: MaybeRefOrGetter<string | null | undefined>) {
  return useQuery({
    queryKey: computed(() => getGetTaskQueryKey(toValue(taskId) ?? '')),
    queryFn: async ({ signal }) => (await getTask(toValue(taskId) as string, { signal })).data as Task,
    enabled: computed(() => Boolean(toValue(taskId))),
    staleTime: Infinity,
  });
}

export function useRecentTasks(vmId: MaybeRefOrGetter<string | undefined>) {
  const queryClient = useQueryClient();
  const key = computed(() => getListTasksQueryKey(recentTasksParams(toValue(vmId) ?? '')));
  return useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const res = (await listTasks(recentTasksParams(toValue(vmId) as string), { signal })).data as TaskPage;
      return mergeTaskPage(queryClient.getQueryData<TaskPage>(key.value), res.items); // never undo newer event data
    },
    enabled: computed(() => Boolean(toValue(vmId))),
  });
}

/** The tenant's display name for an admin's confirmation (AC-CMP-4.3), when the session may read tenants. */
export function useTenant(tenantId: MaybeRefOrGetter<string | undefined>, enabled: MaybeRefOrGetter<boolean>) {
  return useQuery({
    queryKey: computed(() => getGetTenantQueryKey(toValue(tenantId) ?? '')),
    queryFn: async ({ signal }) => (await getTenant(toValue(tenantId) as string, { signal })).data as Tenant,
    enabled: computed(() => Boolean(toValue(tenantId)) && toValue(enabled)),
    staleTime: Infinity,
  });
}

// ── Cache helpers ──

const vmsKey = getListVmsQueryKey(); // ['vms']: list pages and every getVm
const isPages = (data: unknown): data is VmPages => typeof data === 'object' && data !== null && 'pages' in data;
const isVm = (data: unknown): data is Vm => typeof data === 'object' && data !== null && 'id' in data && 'status' in data;

function patchData(data: unknown, patches: ReadonlyMap<string, VmPatch>): unknown {
  if (isPages(data)) {
    let changed = false;
    const pages = data.pages.map((page) => {
      if (!page.items.some((vm) => patches.has(vm.id))) return page;
      changed = true;
      return { ...page, items: page.items.map((vm) => (patches.has(vm.id) ? { ...vm, ...patches.get(vm.id) } : vm)) };
    });
    return changed ? { ...data, pages } : data;
  }
  if (isVm(data) && patches.has(data.id)) return { ...data, ...patches.get(data.id) };
  return data;
}

/** Applies patches to every cached copy of those VMs in **one** cache write (AC-CMP-1.2). */
export function patchVms(queryClient: QueryClient, patches: ReadonlyMap<string, VmPatch>): void {
  if (patches.size === 0) return;
  queryClient.setQueriesData({ queryKey: vmsKey }, (data: unknown) => patchData(data, patches));
}

export const patchVm = (queryClient: QueryClient, patch: VmPatch) => patchVms(queryClient, new Map([[patch.id, patch]]));

function findListedVm(queryClient: QueryClient, id: string): Vm | undefined {
  for (const [, data] of queryClient.getQueriesData<VmPages>({ queryKey: vmsKey })) {
    if (!isPages(data)) continue;
    for (const page of data.pages) {
      const hit = page.items.find((vm) => vm.id === id);
      if (hit) return hit;
    }
  }
  return undefined;
}

/** The newest cached copy of a VM: its `getVm`, else its list row. */
export function findVm(queryClient: QueryClient, id: string): Vm | undefined {
  return queryClient.getQueryData<Vm>(getGetVmQueryKey(id)) ?? findListedVm(queryClient, id);
}

export function mergeTaskPage(page: TaskPage | undefined, incoming: readonly Task[]): TaskPage {
  const byId = new Map((page?.items ?? []).map((task) => [task.id, task]));
  for (const task of incoming) byId.set(task.id, mergeTask(byId.get(task.id), task));
  const items = [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, RECENT_TASKS);
  return { items, nextCursor: null, total: items.length };
}

/** Merges a VM task into its `getTask` cache and, when cached, the VM drawer's recent tasks (RT-4). */
export function applyTask(queryClient: QueryClient, task: Task): void {
  queryClient.setQueryData<Task>(getGetTaskQueryKey(task.id), (current) => mergeTask(current, task));
  const recent = getListTasksQueryKey(recentTasksParams(task.resource.id));
  if (queryClient.getQueryData(recent)) queryClient.setQueryData<TaskPage>(recent, (page) => mergeTaskPage(page, [task]));
}

/** The toast for a VM task that has ended (SPEC-CMP-2, D6-08). */
export function taskOutcomeMessage(task: Task): string {
  const name = task.resource.name;
  if (task.status === 'failed') return messageFor({ code: task.error?.code ?? 'INTERNAL', params: { name, ...(task.error?.params ?? {}) } });
  if (task.kind === 'vm.start') return t('compute.toast.started', { name });
  if (task.kind === 'vm.stop') return t('compute.toast.stopped', { name });
  return t('compute.toast.rebooted', { name });
}

// ── Mutations ──

export interface ActionRequest {
  vm: Vm;
  action: VmAction;
}

/**
 * SPEC-CMP-2, D6-09, D6-10: the row and the drawer show the transitional status at once. After the 202
 * the task is seeded into `getTask` and published (`task:started`); on an error the status is rolled
 * back, the mapped message is shown and the VM is fetched again so a stale row is corrected.
 */
export function useVmAction(events: ScopedBus, onStarted: (task: Task) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ vm, action }: ActionRequest) => (await runVmAction(vm.id, { action })).data as Task,
    onMutate: ({ vm, action }) => {
      patchVm(queryClient, { id: vm.id, status: DURING[action] });
      return { previous: vm.status };
    },
    onSuccess: (task, { vm }) => {
      applyTask(queryClient, task);
      patchVm(queryClient, { id: vm.id, activeTaskId: task.id });
      onStarted(task);
      events.publish('task:started', { task });
    },
    onError: (error, { vm }, context) => {
      if (context) patchVm(queryClient, { id: vm.id, status: context.previous });
      events.publish('toast:show', { kind: 'error', message: errorMessage(error), resource: { type: 'vm', id: vm.id } });
      void queryClient
        .fetchQuery({ queryKey: getGetVmQueryKey(vm.id), queryFn: async () => (await getVm(vm.id)).data as Vm, staleTime: 0 })
        .then((fresh) => patchVm(queryClient, fresh), () => undefined);
    },
  });
}

// ── Server events (RT-3…RT-7) ──

export interface ComputeEventHandlers {
  /** A VM's status changed through a server event (AC-CMP-1.4 announcements). */
  onStatusChange?(change: { name: string; status: VmStatus }): void;
  /** A VM task reached `succeeded` or `failed`. */
  onTaskFinished?(task: Task): void;
}

/**
 * Applies server events to this area's cache, batched per animation frame (RT-5, D6-11): every
 * `vm.updated` in one frame becomes **one** `setQueriesData`, later events for the same VM win. A
 * reconnect invalidates this client's active queries (RT-6). The cleanup cancels a pending frame (RT-7).
 */
export function subscribeComputeEvents(events: ScopedBus, queryClient: QueryClient, handlers: ComputeEventHandlers = {}): () => void {
  const vms = new Map<string, VmEvent>();
  const tasks = new Map<string, Task>();
  let frame = 0;

  const flush = () => {
    frame = 0;
    const changes: { name: string; status: VmStatus }[] = [];
    for (const patch of vms.values()) {
      const current = findVm(queryClient, patch.id);
      if (current && current.status !== patch.status) changes.push({ name: current.name, status: patch.status });
    }
    patchVms(queryClient, vms);
    for (const task of tasks.values()) applyTask(queryClient, task);
    vms.clear();
    tasks.clear();
    for (const change of changes) handlers.onStatusChange?.(change);
  };
  const schedule = () => {
    frame ||= requestAnimationFrame(flush);
  };

  const offs = [
    events.subscribe('server:vm.updated', ({ vm }) => {
      vms.set(vm.id, { ...vms.get(vm.id), ...vm });
      schedule();
    }),
    events.subscribe('server:task.updated', ({ task }) => {
      if (task.resource.type !== 'vm') return;
      tasks.set(task.id, mergeTask(tasks.get(task.id), task));
      schedule();
      if (task.status === 'succeeded' || task.status === 'failed') handlers.onTaskFinished?.(task);
    }),
    events.subscribe('realtime:reconnected', () => void queryClient.invalidateQueries()), // only this area's client
  ];
  return () => {
    offs.forEach((off) => off());
    cancelAnimationFrame(frame);
    frame = 0;
    vms.clear();
    tasks.clear();
  };
}
