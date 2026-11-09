import { describe, expect, it, vi } from 'vitest';
import { createRootBus } from './event-bus';

const status = { state: 'reconnecting', attempt: 2 } as const;

describe('createRootBus', () => {
  it('RT-9: a subscriber added after realtime:status was published receives the latest value synchronously', () => {
    const bus = createRootBus();
    bus.publish('realtime:status', { state: 'connecting', attempt: 0 });
    bus.publish('realtime:status', status);
    const handler = vi.fn();
    bus.scope('compute').subscribe('realtime:status', handler);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(status, expect.objectContaining({ source: 'shell' }));
  });

  it('RT-9: only realtime:status is sticky', () => {
    const bus = createRootBus();
    bus.publish('realtime:reconnected', { downtimeMs: 10 });
    const handler = vi.fn();
    bus.subscribe('realtime:reconnected', handler);
    expect(handler).not.toHaveBeenCalled();
  });

  it("RT-8: an error in one subscriber doesn't stop delivery and is reported with the subscriber's scope", () => {
    const onError = vi.fn();
    const bus = createRootBus({ onError });
    const after = vi.fn();
    bus.scope('tenants').subscribe('realtime:reconnected', () => {
      throw new Error('boom');
    });
    bus.scope('compute').subscribe('realtime:reconnected', after);
    bus.publish('realtime:reconnected', { downtimeMs: 5 });
    expect(after).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), { event: 'realtime:reconnected', subscriber: 'tenants' });
  });

  it('MF-5: dispose() removes every subscription of that scope and nothing else', () => {
    const bus = createRootBus();
    const compute = bus.scope('compute');
    compute.subscribe('realtime:status', () => {});
    compute.subscribe('server:vm.updated', () => {});
    bus.scope('tenants').subscribe('realtime:status', () => {});
    expect(bus.subscriberCount('compute')).toBe(2);
    compute.dispose();
    expect(bus.subscriberCount('compute')).toBe(0);
    expect(bus.subscriberCount('tenants')).toBe(1);
  });

  it('MF-5: the unsubscribe function returned by subscribe() removes that handler', () => {
    const bus = createRootBus();
    const handler = vi.fn();
    const off = bus.scope('storage').subscribe('realtime:reconnected', handler);
    off();
    bus.publish('realtime:reconnected', { downtimeMs: 1 });
    expect(handler).not.toHaveBeenCalled();
    expect(bus.subscriberCount('storage')).toBe(0);
  });

  it('TECH-1: deliveries carry meta.source of the publishing scope', () => {
    const bus = createRootBus();
    const handler = vi.fn();
    bus.subscribe('toast:show', handler);
    bus.scope('compute').publish('toast:show', { kind: 'info', message: 'hi' });
    expect(handler).toHaveBeenCalledWith({ kind: 'info', message: 'hi' }, expect.objectContaining({ source: 'compute' }));
  });

  it('TECH-1: in strict mode a remote publishing an event outside RemotePublishable throws', () => {
    const bus = createRootBus({ strict: true });
    const scoped = bus.scope('compute') as unknown as { publish: (t: string, p: unknown) => void };
    expect(() => scoped.publish('server:vm.updated', { vm: {} })).toThrow(/may not publish/);
  });

  it('TECH-1: outside strict mode that publish is dropped and reported', () => {
    const onError = vi.fn();
    const bus = createRootBus({ strict: false, onError });
    const handler = vi.fn();
    bus.subscribe('server:vm.updated', handler);
    const scoped = bus.scope('compute') as unknown as { publish: (t: string, p: unknown) => void };
    scoped.publish('server:vm.updated', { vm: {} });
    expect(handler).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.any(Error), { event: 'server:vm.updated', subscriber: 'compute' });
  });
});
