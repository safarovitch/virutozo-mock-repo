// Server events → compute's cache (RT-4…RT-7), without components.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getGetTaskQueryKey, getGetVmQueryKey, getListVmsQueryKey } from '@nimbus/api-client/vue';
import type { Task, Vm } from '@nimbus/api-client/model';
import { createFakeBus } from '@nimbus/test-utils';
import { createComputeQueryClient, listParams, subscribeComputeEvents, taskOutcomeMessage, type VmPages } from './data';
import { makeVms, task } from './testing/fake-api';

const pagesOf = (items: Vm[]): VmPages => ({ pages: [{ items, nextCursor: null, total: items.length }], pageParams: [undefined] });

function setup() {
  const fake = createFakeBus('compute');
  const queryClient = createComputeQueryClient();
  const listKey = getListVmsQueryKey(listParams(undefined));
  const vms = makeVms();
  queryClient.setQueryData(listKey, pagesOf(vms));
  const changes: { name: string; status: string }[] = [];
  const finished: Task[] = [];
  const off = subscribeComputeEvents(fake.bus, queryClient, { onStatusChange: (c) => changes.push(c), onTaskFinished: (t) => finished.push(t) });
  const row = (id: string) => queryClient.getQueryData<VmPages>(listKey)?.pages[0]?.items.find((vm) => vm.id === id);
  return { fake, queryClient, row, changes, finished, off };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('compute server events', () => {
  it('AC-CMP-1.1: a vm.updated to stopped changes the cached row within one animation frame, with no request', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { fake, row } = setup();
    fake.emit('server:vm.updated', { vm: { id: 'vm_01', status: 'stopped', ip: null, activeTaskId: null } });
    expect(row('vm_01')?.status).toBe('running'); // not before the frame
    vi.advanceTimersToNextFrame();
    expect(row('vm_01')).toMatchObject({ status: 'stopped', ip: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('AC-CMP-1.2: 50 vm.updated events in one frame are one setQueriesData', () => {
    const { fake, queryClient, row } = setup();
    const spy = vi.spyOn(queryClient, 'setQueriesData');
    for (let i = 0; i < 50; i++) {
      const id = `vm_${String((i % 40) + 1).padStart(2, '0')}`;
      fake.emit('server:vm.updated', { vm: { id, status: i < 40 ? 'stopping' : 'stopped', ip: null, activeTaskId: null } });
    }
    vi.advanceTimersToNextFrame();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(row('vm_01')?.status).toBe('stopped'); // the later event for the same VM wins
    expect(row('vm_40')?.status).toBe('stopping');
  });

  it('RT-4: the same write also patches a cached getVm, and VM tasks merge into getTask with mergeTask', () => {
    const { fake, queryClient } = setup();
    const vm = makeVms()[0] as Vm;
    queryClient.setQueryData(getGetVmQueryKey(vm.id), vm);
    queryClient.setQueryData(getGetTaskQueryKey('task_1'), task('task_1', { seq: 5, progress: 60 }));
    fake.emit('server:vm.updated', { vm: { id: vm.id, status: 'rebooting', ip: vm.ip, activeTaskId: 'task_1' } });
    fake.emit('server:task.updated', { task: task('task_1', { seq: 3, progress: 30 }) }); // stale: ignored
    fake.emit('server:task.updated', { task: task('t_other', { resource: { type: 'tenant', id: 't_acme', name: 'acme' } }) }); // not a VM task
    vi.advanceTimersToNextFrame();
    expect(queryClient.getQueryData<Vm>(getGetVmQueryKey(vm.id))).toMatchObject({ status: 'rebooting', activeTaskId: 'task_1' });
    expect(queryClient.getQueryData<Task>(getGetTaskQueryKey('task_1'))?.progress).toBe(60);
    expect(queryClient.getQueryData(getGetTaskQueryKey('t_other'))).toBeUndefined();
  });

  it('AC-CMP-1.4: a status change is reported once per VM per frame, with its name', () => {
    const { fake, changes } = setup();
    fake.emit('server:vm.updated', { vm: { id: 'vm_01', status: 'stopping', ip: null, activeTaskId: 'x' } });
    fake.emit('server:vm.updated', { vm: { id: 'vm_01', status: 'stopped', ip: null, activeTaskId: null } });
    fake.emit('server:vm.updated', { vm: { id: 'vm_02', status: 'running', ip: '10.0.0.2', activeTaskId: null } }); // unchanged
    vi.advanceTimersToNextFrame();
    expect(changes).toEqual([{ name: 'web-01', status: 'stopped' }]);
  });

  it('RT-6: realtime:reconnected invalidates this client\'s queries', () => {
    const { fake, queryClient } = setup();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    fake.emit('realtime:reconnected', { downtimeMs: 2000 });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('RT-7: the cleanup removes every subscription and cancels a pending frame', () => {
    const { fake, row, off } = setup();
    fake.emit('server:vm.updated', { vm: { id: 'vm_01', status: 'stopped', ip: null, activeTaskId: null } });
    off();
    vi.advanceTimersToNextFrame();
    expect(row('vm_01')?.status).toBe('running');
    expect(fake.subscriberCount()).toBe(0);
  });

  it('MSG-3: a finished VM task is reported once it is terminal, with its outcome message from the catalogue', () => {
    const { fake, finished } = setup();
    fake.emit('server:task.updated', { task: task('task_1', { seq: 4 }) });
    fake.emit('server:task.updated', { task: task('task_1', { seq: 5, status: 'succeeded', progress: 100 }) });
    expect(finished.map((t) => t.status)).toEqual(['succeeded']);
    expect(taskOutcomeMessage(finished[0] as Task)).toBe('web-01 rebooted.');
    const failed = task('task_2', { status: 'failed', error: { title: 'x', status: 409, code: 'VM_BUSY' } });
    expect(taskOutcomeMessage(failed)).toBe('web-01 is busy with another operation.'); // D6-08: name from the resource
  });
});
