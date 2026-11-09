// Task merging (specs/shared/realtime.md "Task merging"). Every place that caches tasks upserts through
// mergeTask, so a late `task:started` (seq 0) never overwrites newer progress, in any arrival order.
import type { Task, TaskStatus } from '@nimbus/api-client/model';

export function isTerminal(status: TaskStatus): boolean {
  return status === 'succeeded' || status === 'failed';
}

export function mergeTask(current: Task | undefined, incoming: Task): Task {
  if (!current) return incoming;
  if (isTerminal(current.status)) return current; // succeeded/failed never revert
  return incoming.seq > current.seq ? incoming : current; // stale or duplicate → ignored
}
