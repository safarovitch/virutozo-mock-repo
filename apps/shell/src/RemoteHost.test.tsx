// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { clearLogEntries, logEntries } from '@nimbus/logger';
import { createRootBus, type RemoteContext, type RemoteModule, type RootBus, type SessionSnapshot } from '@nimbus/mf-contract';
import type { Manifest } from './manifest';
import { RemoteHost } from './RemoteHost';
import { loadRemoteModule } from './remotes';

vi.mock('./remotes', () => ({ loadRemoteModule: vi.fn() }));
const load = vi.mocked(loadRemoteModule);

const manifest: Manifest = { tenants: '/remotes/tenants/remoteEntry.js', storage: '/remotes/storage/remoteEntry.js', compute: '/remotes/compute/remoteEntry.js' };
const session: SessionSnapshot = { user: { id: 'u_1', name: 'Pat', email: 'pat@example.test' }, role: 'provider_admin', tenant: null, permissions: [] };

/** A remote that renders a heading and lets the test raise errors from inside it, like its boundary would. */
function fakeRemote() {
  const state: { ctx?: RemoteContext; mounts: number; unmounts: number } = { mounts: 0, unmounts: 0 };
  const module: RemoteModule = {
    mount(el, ctx) {
      state.mounts++;
      state.ctx = ctx;
      el.innerHTML = '<h1>Storage</h1>';
      return {
        unmount: () => {
          state.unmounts++;
          el.innerHTML = '';
        },
        update: () => undefined,
      };
    },
  };
  return { module, state, raise: (fatal: boolean) => state.ctx?.events.publish('remote:error', { remote: 'storage', message: 'boom', fatal }) };
}

function renderHost(bus: RootBus) {
  return render(
    <MemoryRouter initialEntries={['/storage']}>
      <RemoteHost name="storage" title="Storage" manifest={manifest} bus={bus} session={session} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  clearLogEntries();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  load.mockReset();
});

const shellErrors = () => logEntries().filter((e) => e.source === 'shell' && e.level === 'error');

describe('RemoteHost', () => {
  it('AC-SHL-4.3: a fatal remote:error unmounts the remote, disposes its scope, shows the panel and logs one entry naming it', async () => {
    const remote = fakeRemote();
    load.mockResolvedValue(remote.module);
    const bus = createRootBus();
    renderHost(bus);
    expect(await screen.findByRole('heading', { name: 'Storage' })).toBeTruthy();
    remote.state.ctx?.events.subscribe('server:tenant.updated', () => undefined);
    expect(bus.subscriberCount('storage')).toBe(1);

    await act(async () => remote.raise(true));

    expect(await screen.findByRole('heading', { name: 'Storage is temporarily unavailable.' })).toBeTruthy();
    expect(remote.state.unmounts).toBe(1);
    expect(bus.subscriberCount('storage')).toBe(0);
    expect(shellErrors()).toEqual([expect.objectContaining({ event: 'remote.crashed', data: { remote: 'storage', message: 'boom' } })]);
  });

  it('AC-SHL-4.3: a non-fatal remote:error is logged once and the remote stays mounted', async () => {
    const remote = fakeRemote();
    load.mockResolvedValue(remote.module);
    renderHost(createRootBus());
    await screen.findByRole('heading', { name: 'Storage' });

    await act(async () => remote.raise(false));

    expect(screen.getByRole('heading', { name: 'Storage' })).toBeTruthy();
    expect(remote.state.unmounts).toBe(0);
    expect(shellErrors()).toEqual([expect.objectContaining({ event: 'remote.error', data: { remote: 'storage', message: 'boom' } })]);
  });

  it("AC-SHL-4.3: another remote's remote:error doesn't affect this one", async () => {
    const remote = fakeRemote();
    load.mockResolvedValue(remote.module);
    const bus = createRootBus();
    renderHost(bus);
    await screen.findByRole('heading', { name: 'Storage' });

    await act(async () => bus.scope('compute').publish('remote:error', { remote: 'compute', message: 'boom', fatal: true }));

    expect(screen.getByRole('heading', { name: 'Storage' })).toBeTruthy();
    expect(shellErrors()).toEqual([]);
  });

  it('AC-SHL-4.4: Retry after a crash mounts the remote again without a page reload', async () => {
    const remote = fakeRemote();
    load.mockResolvedValue(remote.module);
    renderHost(createRootBus());
    await screen.findByRole('heading', { name: 'Storage' });
    await act(async () => remote.raise(true));
    await screen.findByRole('heading', { name: 'Storage is temporarily unavailable.' });

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('heading', { name: 'Storage' })).toBeTruthy();
    expect(remote.state.mounts).toBe(2);
    expect(load).toHaveBeenLastCalledWith('storage', manifest.storage, true);
  });

  it('AC-SHL-4.1: a load failure shows the panel with Retry and logs one entry naming the remote', async () => {
    load.mockRejectedValue(new Error('503'));
    renderHost(createRootBus());
    expect(await screen.findByRole('heading', { name: 'Storage is temporarily unavailable.' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(shellErrors()).toEqual([expect.objectContaining({ event: 'remote.load_failed', data: { remote: 'storage', message: '503' } })]);
  });
});
