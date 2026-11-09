import { describe, expect, it } from 'vitest';
import type { Task } from '@nimbus/api-client/model';
import { mergeTask } from './task';

const base: Task = {
  id: 'task_1',
  kind: 'vm.reboot',
  status: 'queued',
  progress: 0,
  seq: 0,
  resource: { type: 'vm', id: 'vm_01', name: 'web-01' },
  tenantId: 't_acme',
  error: null,
  createdAt: '2026-10-31T10:00:00Z',
  finishedAt: null,
};
const at = (seq: number, patch: Partial<Task> = {}): Task => ({ ...base, seq, status: 'running', progress: seq * 10, ...patch });

describe('mergeTask', () => {
  it('AC-TSK-1.4: a seq 2 update followed by task:started (seq 0) leaves the task at its seq 2 state', () => {
    const afterWs = mergeTask(undefined, at(2));
    expect(mergeTask(afterWs, base)).toEqual(at(2));
  });

  it('AC-TSK-1.5: a succeeded task never changes back to running', () => {
    const done = at(5, { status: 'succeeded', progress: 100, finishedAt: '2026-10-31T10:00:08Z' });
    expect(mergeTask(done, at(9))).toBe(done);
    expect(mergeTask(done, at(4))).toBe(done);
  });

  it('TECH-4: newer seq wins, duplicates and stale updates are ignored, unknown tasks are inserted', () => {
    expect(mergeTask(undefined, base)).toBe(base);
    expect(mergeTask(at(1), at(2))).toEqual(at(2));
    const current = at(3);
    expect(mergeTask(current, at(3))).toBe(current);
    expect(mergeTask(current, at(1))).toBe(current);
  });
});
