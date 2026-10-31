// The task center's data (SPEC-TSK-1, D4-09): `listTasks` in the shell's own QueryClient (RT-4). Every
// upsert — the list result, `task:started`, `server:task.updated` — goes through mergeTask, so a late
// seq-0 task:started never overwrites newer progress and a finished task never reverts (AC-TSK-1.4/1.5).
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { ListTasksParams, Task, TaskPage } from '@nimbus/api-client/model';
import { getListTasksQueryKey, listTasks } from '@nimbus/api-client/react';
import type { RootBus } from '@nimbus/mf-contract';
import { isTerminal, mergeTask } from '@nimbus/realtime';

export const TASK_LIMIT = 50; // D4-02
export const TASK_WINDOW_MS = 24 * 3600 * 1000;

/** Merges `incoming` into `page` item by item; keeps the newest TASK_LIMIT tasks. */
export function mergeTasks(page: TaskPage | undefined, incoming: readonly Task[]): TaskPage {
  const byId = new Map((page?.items ?? []).map((t) => [t.id, t]));
  for (const task of incoming) byId.set(task.id, mergeTask(byId.get(task.id), task));
  const items = [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, TASK_LIMIT);
  return { items, nextCursor: null, total: items.length };
}

export interface TaskGroups {
  running: Task[];
  recent: Task[];
  /** queued + running (D4-01). */
  activeCount: number;
}

/** Running (queued + running) first, then finished tasks of the last 24 h; newest first in each. */
export function groupTasks(tasks: readonly Task[], now: number): TaskGroups {
  const visible = tasks.filter((t) => !isTerminal(t.status) || Date.parse(t.createdAt) >= now - TASK_WINDOW_MS);
  const running = visible.filter((t) => !isTerminal(t.status));
  return { running, recent: visible.filter((t) => isTerminal(t.status)), activeCount: running.length };
}

/** The list query plus the bus subscriptions that keep it live. Mount once per session (in the header). */
export function useTaskCenter(bus: RootBus) {
  const queryClient = useQueryClient();
  // Fixed per session, so the generated query key stays stable (D4-09).
  const [params] = useState<ListTasksParams>(() => ({ since: new Date(Date.now() - TASK_WINDOW_MS).toISOString(), limit: TASK_LIMIT }));
  const [queryKey] = useState(() => getListTasksQueryKey(params));

  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const res = await listTasks(params, { signal });
      // A refetch never replaces what events already merged in (D4-09).
      return mergeTasks(queryClient.getQueryData<TaskPage>(queryKey), (res.data as TaskPage).items);
    },
  });

  useEffect(() => subscribeTasks(bus, queryClient, queryKey), [bus, queryClient, queryKey]);

  return query;
}

/** Wires `task:started`, `server:task.updated` and `realtime:reconnected` into the cache. Returns cleanup. */
export function subscribeTasks(bus: RootBus, queryClient: QueryClient, queryKey: readonly unknown[]): () => void {
  const upsert = ({ task }: { task: Task }) => queryClient.setQueryData<TaskPage>(queryKey, (page) => mergeTasks(page, [task]));
  const offs = [
    bus.subscribe('task:started', upsert),
    bus.subscribe('server:task.updated', upsert),
    bus.subscribe('realtime:reconnected', () => void queryClient.invalidateQueries({ queryKey })), // RT-6
  ];
  return () => offs.forEach((off) => off());
}
