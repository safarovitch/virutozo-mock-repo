import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@nimbus/api-client';
import type { Me, Role } from '@nimbus/api-client/model';
import { createRootBus, type RootBus } from '@nimbus/mf-contract';
import { createSessionStore, type SessionDeps } from './session';

const me = (role: Role = 'tenant_admin'): Me => ({
  user: { id: 'u_1', name: 'Tara Admin', email: 'tara@acme.example' },
  role,
  tenant: role.startsWith('tenant') ? { id: 't_acme', displayName: 'Acme Corporation', planName: 'Business', status: 'active' } : null,
  resellerId: null,
  permissions: ['vm:read', 'bucket:read', 'quota:read', 'task:read'],
});
const unauthorized = () => new ApiError({ title: 'x', status: 401, code: 'UNAUTHENTICATED' });

function setup(overrides: Partial<SessionDeps> = {}) {
  const deps = {
    getMe: vi.fn(async () => me()),
    login: vi.fn(async (role: Role) => me(role)),
    logout: vi.fn(async () => undefined),
    createBus: vi.fn(() => createRootBus({ strict: true })),
    queryClient: { clear: vi.fn() },
    location: vi.fn(() => ({ pathname: '/tenants/t_acme', search: '?status=active', hash: '' })),
    ...overrides,
    startRealtime: vi.fn<(bus: RootBus) => { stop: () => void }>(() => ({ stop: vi.fn() })),
  } satisfies SessionDeps;
  return { deps, store: createSessionStore(deps) };
}

describe('session store', () => {
  it('AC-SHL-1.6: a valid cookie at boot signs the user in without visiting /login', async () => {
    const { store } = setup();
    await store.boot();
    expect(store.getState()).toMatchObject({ status: 'signedIn', session: { role: 'tenant_admin' } });
  });

  it('AC-SHL-1.7: a 401 at boot means signed out, not expired (D3-07)', async () => {
    const { store } = setup({ getMe: vi.fn(async () => Promise.reject(unauthorized())) });
    await store.boot();
    store.expire(); // the 401's onUnauthorized: ignored before a successful boot
    // No redirect: the router sends the user to /login?returnTo=<url>, without reason=expired.
    expect(store.getState()).toEqual({ status: 'signedOut' });
  });

  it('AC-SHL-1.6: any other boot failure is shown as an error, not as signed out', async () => {
    const { store } = setup({ getMe: vi.fn(async () => Promise.reject(new ApiError({ title: 'x', status: 500, code: 'INTERNAL' }))) });
    await store.boot();
    expect(store.getState().status).toBe('bootFailed');
  });

  it('AC-SHL-1.4: a 401 after boot ends the session and goes to /login?reason=expired with the current path and query', async () => {
    const { deps, store } = setup();
    await store.boot();
    store.expire();
    expect(store.getState()).toEqual({ status: 'signedOut', redirect: '/login?reason=expired&returnTo=%2Ftenants%2Ft_acme%3Fstatus%3Dactive' });
    expect(deps.queryClient.clear).toHaveBeenCalledTimes(1);
  });

  it('AC-SHL-1.4: session:expired from a remote ends the session the same way', async () => {
    const { store } = setup();
    await store.boot();
    const state = store.getState();
    if (state.status !== 'signedIn') throw new Error('expected signed in');
    state.bus.scope('compute').publish('session:expired', { source: 'compute' });
    expect(store.getState()).toEqual({ status: 'signedOut', redirect: '/login?reason=expired&returnTo=%2Ftenants%2Ft_acme%3Fstatus%3Dactive' });
  });

  it('AC-SHL-1.3: sign-out clears the shell query client and lands on /login without returnTo', async () => {
    const { deps, store } = setup();
    await store.boot();
    await store.signOut();
    expect(deps.logout).toHaveBeenCalledTimes(1);
    expect(deps.queryClient.clear).toHaveBeenCalledTimes(1);
    expect(store.getState()).toEqual({ status: 'signedOut', redirect: '/login' });
  });

  it('AC-SHL-1.12: signing out after the session already expired lands on /login with no error', async () => {
    const holder: { store?: ReturnType<typeof setup>['store'] } = {};
    const { store } = setup({
      // An expired cookie: logout gets a 401, and customFetch reports it before rejecting.
      logout: vi.fn(async () => {
        holder.store?.expire();
        throw unauthorized();
      }),
    });
    holder.store = store;
    await store.boot();
    await expect(store.signOut()).resolves.toBeUndefined();
    expect(store.getState()).toEqual({ status: 'signedOut', redirect: '/login' }); // not reason=expired
  });

  it('RT-10: every session gets a new root bus; old subscriptions hear nothing', async () => {
    const { deps, store } = setup();
    await store.boot();
    const first = store.getState();
    if (first.status !== 'signedIn') throw new Error('expected signed in');
    const heard = vi.fn();
    first.bus.subscribe('toast:show', heard);
    await store.signOut();
    await store.signIn('tenant_viewer');
    const second = store.getState();
    if (second.status !== 'signedIn') throw new Error('expected signed in');
    expect(second.bus).not.toBe(first.bus);
    second.bus.publish('toast:show', { kind: 'info', message: 'hi' });
    expect(heard).not.toHaveBeenCalled();
    expect(deps.createBus).toHaveBeenCalledTimes(2);
  });

  it('AC-SHL-6.12: after sign-out and sign-in, no subscription from the previous session receives events', async () => {
    const { deps, store } = setup();
    await store.boot();
    const first = store.getState();
    if (first.status !== 'signedIn') throw new Error('expected signed in');
    const heard = vi.fn();
    first.bus.subscribe('server:task.updated', heard);
    first.bus.scope('compute').subscribe('realtime:status', heard);
    await store.signOut();
    await store.signIn('tenant_viewer');
    // The second session's realtime client publishes on the bus it was started with.
    const secondBus = deps.startRealtime.mock.calls[1]?.[0] as RootBus;
    secondBus.publish('realtime:status', { state: 'connected', attempt: 0 });
    secondBus.publish('server:task.updated', { task: {} as never });
    expect(heard).not.toHaveBeenCalled();
    expect(deps.startRealtime.mock.calls[0]?.[0]).toBe(first.bus);
  });

  it('TECH-4: each session starts its own realtime client on its bus; sign-out and expiry stop it (RT-10)', async () => {
    const { deps, store } = setup();
    await store.boot();
    const firstClient = deps.startRealtime.mock.results[0]?.value as { stop: ReturnType<typeof vi.fn> };
    await store.signOut();
    expect(firstClient.stop).toHaveBeenCalledTimes(1);
    await store.signIn('tenant_admin');
    const secondClient = deps.startRealtime.mock.results[1]?.value as { stop: ReturnType<typeof vi.fn> };
    store.expire();
    expect(secondClient.stop).toHaveBeenCalledTimes(1);
    expect(deps.startRealtime).toHaveBeenCalledTimes(2);
  });

  it('AC-SHL-6.6: session:expired from the realtime client (close 4401) goes to /login?reason=expired', async () => {
    const { deps, store } = setup();
    await store.boot();
    const bus = deps.startRealtime.mock.calls[0]?.[0] as RootBus;
    bus.publish('session:expired', { source: 'realtime' });
    expect(store.getState()).toEqual({ status: 'signedOut', redirect: '/login?reason=expired&returnTo=%2Ftenants%2Ft_acme%3Fstatus%3Dactive' });
  });

  it('AC-SHL-1.1: signing in stores the frozen snapshot from login', async () => {
    const { store } = setup();
    await store.boot();
    await store.signOut();
    const session = await store.signIn('tenant_viewer');
    expect(session.role).toBe('tenant_viewer');
    expect(Object.isFrozen(session.permissions)).toBe(true);
  });
});
