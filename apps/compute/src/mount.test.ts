// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountRemote } from '@nimbus/test-utils';
import { mount } from './mount';
import { createFakeApi } from './testing/fake-api';
import { tenantSession } from './testing/render';

// A6-01: since Day 6 the area renders only with `vm:read` and talks to the API, so these Day 1 tests
// mount with a tenant session and the fake API; the assertions are unchanged.
const mountCompute = () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(createFakeApi().fetch);
  return mountRemote({ mount }, { source: 'compute', basePath: '/compute', session: tenantSession() });
};
afterEach(() => vi.restoreAllMocks());

describe('compute mount', () => {
  it("AC-SHL-6.3: subscriberCount('compute') is 0 after compute unmounts", () => {
    const remote = mountCompute();
    expect(remote.fake.subscriberCount()).toBeGreaterThan(0);
    expect(remote.unmount()).toBe(0); // removed by the remote itself, before the shell's dispose (RT-7)
    expect(remote.fake.root.subscriberCount('compute')).toBe(0);
  });

  it('TECH-4: compute receives realtime events through its own bus scope', () => {
    const remote = mountCompute();
    expect(() => remote.fake.emit('realtime:reconnected', { downtimeMs: 500 })).not.toThrow();
    expect(remote.el.querySelector('h1')?.textContent).toBe('Compute');
    remote.unmount();
  });
});
