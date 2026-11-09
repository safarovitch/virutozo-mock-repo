// SPEC-SHL-7: two session stores joined by a fake BroadcastChannel pair (a tab never hears itself).
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@nimbus/api-client';
import type { Me, Role } from '@nimbus/api-client/model';
import { createRootBus, type RootBus } from '@nimbus/mf-contract';
import { clearLogEntries, logEntries } from '@nimbus/logger';
import { createSessionStore, type SessionDeps } from './session';
import { createTabChannel, isTabMessage, type ChannelLike } from './tabs';

type Listener = (event: { data: unknown }) => void;

/** BroadcastChannel semantics: a post reaches every other channel of the hub, never the sender. */
function createHub() {
  const channels = new Set<{ listeners: Set<Listener> }>();
  return () => {
    const self = { listeners: new Set<Listener>() };
    channels.add(self);
    const channel: ChannelLike = {
      postMessage: (data) => {
        for (const other of channels) if (other !== self) for (const l of other.listeners) l({ data: structuredClone(data) });
      },
      addEventListener: (_type, l) => void self.listeners.add(l),
      removeEventListener: (_type, l) => void self.listeners.delete(l),
    };
    return channel;
  };
}

const USERS: Record<Role, string> = { provider_admin: 'u_provider', reseller_admin: 'u_reseller', tenant_admin: 'u_tadmin', tenant_viewer: 'u_viewer' };
const me = (role: Role): Me => ({
  user: { id: USERS[role], name: role, email: `${role}@nimbus.test` },
  role,
  tenant: role.startsWith('tenant') ? { id: 't_acme', displayName: 'Acme Corporation', planName: 'Business', status: 'active' } : null,
  resellerId: null,
  permissions: ['vm:read'],
});

function tab(channel: ChannelLike, { role = 'provider_admin' as Role, path = '/tenants', search = '' } = {}) {
  const location = { pathname: path, search, hash: '' };
  const deps = {
    getMe: vi.fn(async () => me(role)),
    login: vi.fn(async (r: Role) => me(r)),
    logout: vi.fn(async () => undefined),
    createBus: vi.fn(() => createRootBus({ strict: true })),
    startRealtime: vi.fn<(bus: RootBus) => { stop: () => void }>(() => ({ stop: vi.fn() })),
    queryClient: { clear: vi.fn() },
    location: () => location,
    tabs: createTabChannel(channel),
    origin: 'http://localhost:8080',
    reload: vi.fn(),
    load: vi.fn(),
  } satisfies SessionDeps;
  return { deps, location, store: createSessionStore(deps) };
}

const unauthorized = () => new ApiError({ title: 'x', status: 401, code: 'UNAUTHENTICATED' });

describe('SPEC-SHL-7 multi-tab session', () => {
  it('AC-SHL-7.1: signing out in tab A ends tab B\'s session at once, before A calls logout', async () => {
    const open = createHub();
    const a = tab(open());
    const b = tab(open());
    await a.store.boot();
    await b.store.boot();
    a.deps.logout.mockImplementation(async () => {
      expect(b.store.getState()).toEqual({ status: 'signedOut', redirect: '/login' }); // B already handled it
    });
    await a.store.signOut();
    expect(a.deps.logout).toHaveBeenCalledOnce();
    expect(b.deps.queryClient.clear).toHaveBeenCalledOnce();
    expect(b.deps.logout).not.toHaveBeenCalled();
    b.store.expire(); // B's own 4401 arrives later: ignored
    expect(b.store.getState()).toEqual({ status: 'signedOut', redirect: '/login' });
  });

  it('AC-SHL-7.3: an expiry seen in tab A sends tab B to /login?reason=expired with B\'s own returnTo', async () => {
    const open = createHub();
    const a = tab(open(), { path: '/compute' });
    const b = tab(open(), { path: '/storage', search: '?tenantId=t_acme' });
    await a.store.boot();
    await b.store.boot();
    a.store.expire();
    expect(b.store.getState()).toEqual({ status: 'signedOut', redirect: '/login?reason=expired&returnTo=%2Fstorage%3FtenantId%3Dt_acme' });
    expect(a.store.getState()).toMatchObject({ status: 'signedOut', redirect: expect.stringContaining('reason=expired') });
  });

  it('AC-SHL-7.2: a sign-in as a different user reloads a signed-in tab; the same user refreshes Me without a reload', async () => {
    const open = createHub();
    const a = tab(open(), { role: 'tenant_admin' });
    const b = tab(open(), { role: 'tenant_admin' });
    await a.store.boot();
    await b.store.boot();
    a.deps.getMe.mockRejectedValue(unauthorized());
    await a.store.boot(); // A: signed out (e.g. a fresh /login)
    const before = b.store.getState();
    await a.store.signIn('tenant_admin');
    await vi.waitFor(() => expect(b.store.getState()).not.toBe(before));
    expect(b.deps.reload).not.toHaveBeenCalled();
    expect(b.store.getState()).toMatchObject({ status: 'signedIn', session: { user: { id: 'u_tadmin' } } });
    expect((b.store.getState() as { bus: RootBus }).bus).toBe((before as { bus: RootBus }).bus); // same bus: remotes get update(ctx)

    await a.store.signIn('provider_admin');
    expect(b.deps.reload).toHaveBeenCalledOnce();
  });

  it('AC-SHL-7.4: a /login tab follows a sign-in: its returnTo for the same user, the home area for another (D8-02)', async () => {
    const open = createHub();
    const a = tab(open());
    const b = tab(open(), { path: '/login', search: '?reason=expired&returnTo=%2Ftenants%3Fq%3Dacme' });
    await b.store.boot(); // B was signed in as the provider …
    b.store.expire(); // … and expired
    await a.store.signIn('provider_admin');
    expect(b.deps.load).toHaveBeenLastCalledWith('/tenants?q=acme');

    await a.store.signIn('tenant_admin');
    expect(b.deps.load).toHaveBeenLastCalledWith('/'); // another user: never the previous user's page

    const c = tab(open(), { path: '/login', search: '?returnTo=https%3A%2F%2Fevil.example%2F' });
    c.deps.getMe.mockRejectedValue(unauthorized());
    await c.store.boot();
    await a.store.signIn('provider_admin');
    expect(c.deps.load).toHaveBeenLastCalledWith('/'); // an invalid returnTo is never followed
  });

  it('NFR-SEC-3: messages carry no secrets, and anything that isn\'t one of the three shapes is ignored and logged once', async () => {
    const open = createHub();
    const sent: unknown[] = [];
    const spy = open();
    spy.addEventListener('message', (e) => sent.push(e.data));
    const a = tab(open());
    await a.store.signIn('provider_admin');
    await a.store.signOut();
    expect(sent).toEqual([{ type: 'signed-in', userId: 'u_provider' }, { type: 'signed-out' }]);

    clearLogEntries();
    const b = tab(open());
    await b.store.boot();
    spy.postMessage({ type: 'signed-out', extra: 'x' });
    spy.postMessage({ type: 'signed-in' });
    spy.postMessage('signed-out');
    expect(b.store.getState().status).toBe('signedIn');
    expect(logEntries().filter((e) => e.event === 'tabs.message.invalid')).toHaveLength(2); // once per tab (A and B), not once per message
    expect([isTabMessage({ type: 'expired' }), isTabMessage({ type: 'signed-in', userId: 'u' }), isTabMessage(null)]).toEqual([true, true, false]);
  });
});
