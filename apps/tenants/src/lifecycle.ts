// Suspend / resume in progress (SPEC-TEN-4, D7-01): the cached status never changes optimistically; while a
// `tenant.suspend` / `tenant.resume` task runs, the row and the drawer show "Suspending…" / "Resuming…".
// One store per mount, fed by the 202 and by `server:task.updated` (so another tab's task shows too).
import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { messageFor } from '@nimbus/api-client';
import type { Task } from '@nimbus/api-client/model';
import type { ScopedBus } from '@nimbus/mf-contract';
import { isTerminal } from '@nimbus/realtime';
import { patchTenant } from './data';
import { t } from './messages/en';

export type LifecycleKind = 'tenant.suspend' | 'tenant.resume';

export interface Running {
  taskId: string;
  kind: LifecycleKind;
}

export interface LifecycleStore {
  get(tenantId: string): Running | undefined;
  /** The 202 of a suspend/resume started here: shown at once, and its outcome is toasted here (D7-14). */
  started(task: Task): void;
  /** Applies a task update; returns true when it ended a task this mount started. */
  apply(task: Task): boolean;
  subscribe(listener: () => void): () => void;
}

const isLifecycle = (task: Task): task is Task & { kind: LifecycleKind } => task.kind === 'tenant.suspend' || task.kind === 'tenant.resume';

export function createLifecycleStore(): LifecycleStore {
  let running = new Map<string, Running>();
  const mine = new Set<string>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const set = (tenantId: string, value: Running | undefined) => {
    const next = new Map(running);
    if (value) next.set(tenantId, value);
    else next.delete(tenantId);
    running = next;
    emit();
  };
  return {
    get: (tenantId) => running.get(tenantId),
    started(task) {
      if (!isLifecycle(task)) return;
      mine.add(task.id);
      set(task.resource.id, { taskId: task.id, kind: task.kind });
    },
    apply(task) {
      if (!isLifecycle(task)) return false;
      const tenantId = task.resource.id;
      if (!isTerminal(task.status)) {
        if (running.get(tenantId)?.taskId !== task.id) set(tenantId, { taskId: task.id, kind: task.kind });
        return false;
      }
      if (running.get(tenantId)?.taskId === task.id) set(tenantId, undefined);
      return mine.delete(task.id);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Outside the area (stories of the list on its own) nothing is ever running. */
const IDLE: LifecycleStore = { get: () => undefined, started: () => undefined, apply: () => false, subscribe: () => () => undefined };
export const LifecycleContext = createContext<LifecycleStore>(IDLE);

export function useRunning(tenantId: string): Running | undefined {
  const store = useContext(LifecycleContext);
  return useSyncExternalStore(store.subscribe, () => store.get(tenantId));
}

export const useLifecycleStore = () => useContext(LifecycleContext);

/**
 * Follows suspend/resume tasks. The runner sends the final `task.updated` before `tenant.updated`, so a
 * success sets the status the task produced at once instead of showing the old one for a moment. A failure
 * changes nothing: the row was never changed (AC-TEN-4.3). Outcomes of tasks started here are toasted here.
 */
export function subscribeLifecycle(events: ScopedBus, store: LifecycleStore, queryClient: QueryClient): () => void {
  return events.subscribe('server:task.updated', ({ task }) => {
    if (!isLifecycle(task)) return;
    const ended = store.apply(task);
    if (task.status === 'succeeded') patchTenant(queryClient, task.resource.id, { status: task.kind === 'tenant.suspend' ? 'suspended' : 'active' });
    if (!ended) return;
    if (task.status === 'succeeded') {
      const key = task.kind === 'tenant.suspend' ? 'tenants.toast.suspended' : 'tenants.toast.resumed';
      events.publish('toast:show', { kind: 'success', message: t(key, { name: task.resource.name }), resource: { type: 'tenant', id: task.resource.id } });
    } else if (task.status === 'failed') {
      events.publish('toast:show', { kind: 'error', message: messageFor(task.error ?? { code: 'INTERNAL' }), resource: { type: 'tenant', id: task.resource.id } });
    }
  });
}

export function useLifecycleEvents(events: ScopedBus, store: LifecycleStore): void {
  const queryClient = useQueryClient();
  useEffect(() => subscribeLifecycle(events, store, queryClient), [events, store, queryClient]);
}
