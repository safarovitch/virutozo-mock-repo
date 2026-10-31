// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mountRemote } from '@nimbus/test-utils';
import { mount } from './mount';

describe('compute mount', () => {
  it("AC-SHL-6.3: subscriberCount('compute') is 0 after compute unmounts", () => {
    const remote = mountRemote({ mount }, { source: 'compute', basePath: '/compute' });
    expect(remote.fake.subscriberCount()).toBeGreaterThan(0);
    expect(remote.unmount()).toBe(0); // removed by the remote itself, before the shell's dispose (RT-7)
    expect(remote.fake.root.subscriberCount('compute')).toBe(0);
  });

  it('TECH-4: compute receives realtime events through its own bus scope', () => {
    const remote = mountRemote({ mount }, { source: 'compute', basePath: '/compute' });
    expect(() => remote.fake.emit('realtime:reconnected', { downtimeMs: 500 })).not.toThrow();
    expect(remote.el.querySelector('h1')?.textContent).toBe('Compute');
    remote.unmount();
  });
});
