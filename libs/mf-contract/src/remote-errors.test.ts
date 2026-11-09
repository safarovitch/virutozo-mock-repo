import { describe, expect, it, vi } from 'vitest';
import { createRootBus } from './event-bus';
import { reportUncaughtErrors } from './remote-errors';

const errorAt = (url: string) => {
  const error = new Error('boom');
  error.stack = `Error: boom\n    at onClick (${url}assets/index.js:1:2)`;
  return error;
};

describe('reportUncaughtErrors', () => {
  it("MF-6: an uncaught error from the remote's own code is published as a non-fatal remote:error", () => {
    const root = createRootBus();
    const seen = vi.fn();
    root.subscribe('remote:error', seen);
    const target = new EventTarget();
    const off = reportUncaughtErrors('tenants', root.scope('tenants'), 'http://x/remotes/tenants/', target);
    target.dispatchEvent(Object.assign(new Event('error'), { error: errorAt('http://x/remotes/tenants/') }));
    target.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: errorAt('http://x/remotes/tenants/') }));
    expect(seen).toHaveBeenCalledTimes(2);
    expect(seen.mock.calls[0]?.[0]).toMatchObject({ remote: 'tenants', message: 'boom', fatal: false });
    off();
    target.dispatchEvent(Object.assign(new Event('error'), { error: errorAt('http://x/remotes/tenants/') }));
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it("MF-6: errors from another remote's code are ignored", () => {
    const root = createRootBus();
    const seen = vi.fn();
    root.subscribe('remote:error', seen);
    const target = new EventTarget();
    reportUncaughtErrors('tenants', root.scope('tenants'), 'http://x/remotes/tenants/', target);
    target.dispatchEvent(Object.assign(new Event('error'), { error: errorAt('http://x/remotes/storage/') }));
    target.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: 'not an error' }));
    expect(seen).not.toHaveBeenCalled();
  });
});
