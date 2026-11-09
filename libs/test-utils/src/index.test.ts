import { describe, expect, it } from 'vitest';
import type { RemoteModule } from '@nimbus/mf-contract';
import { createFakeBus, mountRemote } from './index';

describe('createFakeBus', () => {
  it('TECH-4: records what the remote publishes and delivers what the shell emits', () => {
    const fake = createFakeBus('compute');
    const seen: string[] = [];
    fake.bus.subscribe('server:vm.updated', ({ vm }) => seen.push(vm.id));
    fake.emit('server:vm.updated', { vm: { id: 'vm_01', status: 'running', ip: null, activeTaskId: null } });
    fake.bus.publish('toast:show', { kind: 'info', message: 'hi' });
    expect(seen).toEqual(['vm_01']);
    expect(fake.published).toEqual([{ type: 'toast:show', payload: { kind: 'info', message: 'hi' }, source: 'compute' }]);
    expect(fake.subscriberCount()).toBe(1);
  });
});

describe('mountRemote', () => {
  it('TECH-4: mounts, updates and unmounts a RemoteModule, reporting subscriptions left behind', () => {
    const log: string[] = [];
    const module: RemoteModule = {
      mount(el, ctx) {
        el.textContent = ctx.path;
        const off = ctx.events.subscribe('realtime:reconnected', () => {});
        return {
          update: (next) => void (el.textContent = next.path),
          unmount: () => {
            off();
            log.push('unmounted');
          },
        };
      },
    };
    const remote = mountRemote(module, { source: 'compute', path: '/a' });
    expect(remote.el.textContent).toBe('/a');
    expect(remote.fake.subscriberCount()).toBe(1);
    remote.update({ path: '/b' });
    expect(remote.el.textContent).toBe('/b');
    expect(remote.unmount()).toBe(0);
    expect(log).toEqual(['unmounted']);
  });
});
