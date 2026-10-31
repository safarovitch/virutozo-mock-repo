import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLogEntries, logEntries } from '@nimbus/logger';
import { createSessionBus } from './bus';

const vm = { id: 'vm_01', status: 'running', ip: '10.0.0.1', activeTaskId: null } as const;

beforeEach(() => {
  clearLogEntries();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('createSessionBus', () => {
  it("AC-SHL-6.4: a subscriber added while reconnecting receives { state: 'reconnecting' } synchronously", () => {
    const bus = createSessionBus({ strict: true });
    bus.publish('realtime:status', { state: 'reconnecting', attempt: 2 });
    let received: unknown;
    bus.scope('storage').subscribe('realtime:status', (status) => (received = status));
    expect(received).toEqual({ state: 'reconnecting', attempt: 2 });
  });

  it("AC-SHL-6.5: an exception in one subscriber doesn't stop the others, and the log entry names its scope", () => {
    const bus = createSessionBus({ strict: true });
    const other = vi.fn();
    bus.scope('tenants').subscribe('server:vm.updated', () => {
      throw new Error('boom');
    });
    bus.scope('compute').subscribe('server:vm.updated', other);
    bus.publish('server:vm.updated', { vm });
    expect(other).toHaveBeenCalledTimes(1);
    const entries = logEntries().filter((e) => e.event === 'bus.subscriber_error');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ source: 'shell', data: { event: 'server:vm.updated', scope: 'tenants', message: 'boom' } });
  });

  it('AC-SHL-6.11: a remote publishing server:vm.updated throws in tests (strict)', () => {
    const bus = createSessionBus({ strict: true });
    const compute = bus.scope('compute') as unknown as { publish(type: string, payload: unknown): void };
    expect(() => compute.publish('server:vm.updated', { vm })).toThrow(/may not publish/);
  });

  it('AC-SHL-6.11: in production builds it is dropped and logged', () => {
    const bus = createSessionBus({ strict: false });
    const heard = vi.fn();
    bus.subscribe('server:vm.updated', heard);
    const compute = bus.scope('compute') as unknown as { publish(type: string, payload: unknown): void };
    compute.publish('server:vm.updated', { vm });
    expect(heard).not.toHaveBeenCalled();
    expect(logEntries().filter((e) => e.event === 'bus.publish_rejected')).toEqual([
      expect.objectContaining({ level: 'error', data: { event: 'server:vm.updated', scope: 'compute' } }),
    ]);
  });
});
