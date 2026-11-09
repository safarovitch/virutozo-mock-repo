// Task runner (specs/mock-data.md §7): progress every 500 ms with increasing `seq`, then the final
// task.updated, then the resource's own event (vm.updated / tenant.updated) from the caller's effect.
import type { ErrorCode, Task, TaskKind } from '@nimbus/api-client/model';
import type { MockApiConfig } from './config';
import type { Db } from './db';
import type { Hub } from './hub';
import { problemBody } from './problems';

const DURATIONS: Record<TaskKind, [number, number]> = {
  'vm.start': [3000, 5000],
  'vm.stop': [3000, 5000],
  'vm.reboot': [5000, 8000],
  'tenant.suspend': [2000, 4000],
  'tenant.resume': [2000, 4000],
  'tenant.provision': [4000, 6000],
};
const TICK_MS = 500;
const STATUS_FOR: Partial<Record<ErrorCode, number>> = { VM_BUSY: 409, INTERNAL: 500 };

export interface TaskEffects {
  onSuccess?: () => void;
  onFailure?: () => void;
}

export class TaskRunner {
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly failNext = new Map<TaskKind, ErrorCode>();
  private counter = 0;

  constructor(
    private readonly db: () => Db,
    private readonly hub: Hub,
    private readonly config: MockApiConfig,
  ) {}

  /** POST /api/__test/fail-next-task: the next task of this kind fails with `code`. */
  failNextTask(kind: TaskKind, code: ErrorCode): void {
    this.failNext.set(kind, code);
  }

  start(kind: TaskKind, resource: Task['resource'], tenantId: string | null, effects: TaskEffects = {}): Task {
    const task: Task = {
      id: `task_${Date.now().toString(36)}${(++this.counter).toString(36)}`,
      kind,
      status: 'queued',
      progress: 0,
      seq: 0, // the 201/202 response carries seq 0 (mergeTask, specs/shared/realtime.md)
      resource,
      tenantId,
      error: null,
      createdAt: new Date().toISOString(),
      finishedAt: null,
    };
    this.db().tasks.set(task.id, task);

    const [min, max] = DURATIONS[kind];
    const duration = (min + Math.random() * (max - min)) * this.config.timeScale;
    const tick = TICK_MS * this.config.timeScale;
    let elapsed = 0;
    // The last wait is shortened so the task ends exactly at its duration, never up to a tick later.
    const nextDelay = () => Math.min(tick, duration - elapsed);

    const step = (waited: number) => {
      elapsed += waited;
      if (elapsed < duration) {
        Object.assign(task, { status: 'running', progress: Math.min(99, Math.floor((elapsed / duration) * 100)), seq: task.seq + 1 });
        this.hub.publish({ type: 'task.updated', task: { ...task } }, tenantId);
        const delay = nextDelay();
        this.schedule(() => step(delay), delay);
        return;
      }
      const forced = this.failNext.get(kind);
      if (forced) this.failNext.delete(kind);
      const code: ErrorCode | undefined = forced ?? (kind === 'vm.reboot' && Math.random() < this.config.failureRate ? 'VM_BUSY' : undefined);
      const params = resource.type === 'vm' ? { name: resource.name } : undefined;
      Object.assign(task, {
        status: code ? 'failed' : 'succeeded',
        progress: code ? task.progress : 100,
        seq: task.seq + 1,
        finishedAt: new Date().toISOString(),
        error: code ? problemBody(STATUS_FOR[code] ?? 409, code, params ? { params } : {}) : null,
      });
      this.hub.publish({ type: 'task.updated', task: { ...task } }, tenantId);
      if (code) effects.onFailure?.();
      else effects.onSuccess?.();
    };
    const first = nextDelay();
    this.schedule(() => step(first), first);
    return { ...task };
  }

  private schedule(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  }

  stop(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }
}
