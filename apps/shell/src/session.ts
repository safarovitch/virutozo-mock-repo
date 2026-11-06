// The shell's session (SPEC-SHL-1). The session itself is the httpOnly cookie (ADR-0005); the shell only
// keeps the `Me` from login/getMe in memory and learns about expiry from a 401 or `session:expired`.
// Framework-free with injected dependencies, so every rule below is unit-tested (session.test.ts).
import type { QueryClient } from '@tanstack/react-query';
import { loginUrl, returnToFor, safeReturnTo } from '@nimbus/auth';
import type { Me, Role, TenantStatus } from '@nimbus/api-client/model';
import type { RootBus, SessionSnapshot } from '@nimbus/mf-contract';
import type { TabChannel, TabMessage } from './tabs';

export type SessionState =
  | { status: 'booting' }
  | { status: 'bootFailed'; error: unknown }
  /** `redirect`: where the router sends a signed-out user (sign-out, expiry); default /login?returnTo=<url>. */
  | { status: 'signedOut'; redirect?: string }
  | { status: 'signedIn'; session: SessionSnapshot; bus: RootBus };

export interface SessionDeps {
  /** Resolve with `Me` or throw (an `ApiError` with status 401 means "not signed in"). */
  getMe(): Promise<Me>;
  login(role: Role): Promise<Me>;
  logout(): Promise<unknown>;
  createBus(): RootBus;
  /** Opens this session's WebSocket on its bus (TECH-4); `stop()` closes it for good (RT-10). */
  startRealtime(bus: RootBus): { stop(): void };
  /** The shell's own query client (remote clients go away with unmount, MF-2). */
  queryClient: Pick<QueryClient, 'clear'>;
  location(): { pathname: string; search: string; hash: string };
  /** Other tabs (SPEC-SHL-7); absent where BroadcastChannel isn't available. */
  tabs?: TabChannel;
  /** Same-origin URL for full page loads (D8-02); the app's origin for validating `returnTo`. */
  origin?: string;
  /** A full page load: `reload()` stays on the URL, `load(url)` goes to another one. */
  reload?(): void;
  load?(url: string): void;
}

export interface SessionStore {
  getState(): SessionState;
  subscribe(listener: () => void): () => void;
  /** Called once per page load before any route renders (boot). */
  boot(): Promise<void>;
  signIn(role: Role): Promise<SessionSnapshot>;
  signOut(): Promise<void>;
  /** Any 401 after boot, `session:expired` from a remote, or WebSocket close 4401 (published by libs/realtime). */
  expire(): void;
}

export function snapshotOf(me: Me): SessionSnapshot {
  return Object.freeze({
    user: Object.freeze({ ...me.user }),
    role: me.role,
    tenant: me.tenant ? Object.freeze({ ...me.tenant }) : null,
    permissions: Object.freeze([...me.permissions]),
  });
}

const isUnauthenticated = (error: unknown) => typeof error === 'object' && error !== null && 'status' in error && error.status === 401;

export function createSessionStore(deps: SessionDeps): SessionStore {
  let state: SessionState = { status: 'booting' };
  const listeners = new Set<() => void>();
  let unsubscribeBus: (() => void) | null = null;
  let realtime: { stop(): void } | null = null;
  /** The last user this tab was signed in as (D8-02); survives sign-out in this tab's memory only. */
  let lastUserId: string | null = null;
  const tell = (message: TabMessage) => deps.tabs?.post(message);

  const set = (next: SessionState) => {
    state = next;
    for (const listener of listeners) listener();
  };

  const start = (me: Me): SessionSnapshot => {
    const session = snapshotOf(me);
    lastUserId = session.user.id;
    const bus = deps.createBus(); // RT-10: one root bus per session
    const offs = [
      bus.subscribe('session:expired', () => store.expire()),
      // SPEC-SHL-8, D6-14: the user's own tenant changed status (RT-12 delivers it without tenant:read).
      bus.subscribe('server:tenant.updated', ({ tenant }) => patchTenantStatus(tenant.id, tenant.status)),
    ];
    unsubscribeBus = () => offs.forEach((off) => off());
    set({ status: 'signedIn', session, bus });
    realtime = deps.startRealtime(bus); // after the state is signedIn, so a 4401 can expire it
    return session;
  };

  /**
   * Ends the in-memory session. Remotes unmount when the signed-in layout goes away; their caches go with
   * them. The store never navigates itself: React Router runs navigations as transitions, so the router
   * would render the old URL as signed out first. The router follows `redirect` instead (App.tsx).
   */
  /** A new frozen snapshot with the tenant's new status; the layout and the remotes get it as the next session. */
  const patchTenantStatus = (id: string, status: TenantStatus) => {
    if (state.status !== 'signedIn') return;
    const { session, bus } = state;
    if (session.tenant?.id !== id || session.tenant.status === status) return;
    set({ status: 'signedIn', bus, session: Object.freeze({ ...session, tenant: Object.freeze({ ...session.tenant, status }) }) });
  };

  const end = (redirect: string) => {
    unsubscribeBus?.();
    unsubscribeBus = null;
    realtime?.stop(); // closes with 1000, never reconnects (RT-10, D4-07)
    realtime = null;
    deps.queryClient.clear();
    set({ status: 'signedOut', redirect });
  };

  /** What another tab told us (SPEC-SHL-7). Handled without telling anyone else. */
  const onTabMessage = (message: TabMessage) => {
    if (message.type === 'signed-out') {
      if (state.status === 'signedIn') end('/login'); // unsaved input is discarded without a prompt
    } else if (message.type === 'expired') {
      if (state.status === 'signedIn') end(loginUrl({ expired: true, returnTo: returnToFor(deps.location()) }));
    } else if (state.status === 'signedIn') {
      // Another user: nothing from the previous one may survive, so reload. The same user: refresh `Me`.
      if (message.userId !== state.session.user.id) deps.reload?.();
      else void refreshMe();
    } else if (state.status === 'signedOut') {
      // D8-02: a /login tab follows with a full page load: its returnTo only for the same user as before.
      const returnTo = safeReturnTo(new URLSearchParams(deps.location().search).get('returnTo'), deps.origin ?? 'http://invalid');
      deps.load?.(returnTo && message.userId === lastUserId ? returnTo : '/');
    }
  };
  deps.tabs?.subscribe(onTabMessage);

  /** Same user signed in elsewhere: a new snapshot on the same bus, so remotes get `update(ctx)`. */
  const refreshMe = async () => {
    try {
      const me = await deps.getMe();
      if (state.status === 'signedIn' && state.session.user.id === me.user.id) set({ status: 'signedIn', bus: state.bus, session: snapshotOf(me) });
    } catch {
      // A 401 reaches expire() through onUnauthorized; anything else keeps the current snapshot.
    }
  };

  const store: SessionStore = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async boot() {
      set({ status: 'booting' });
      try {
        start(await deps.getMe());
      } catch (error) {
        // D3-07: a 401 at boot just means "not signed in": no `reason=expired`.
        if (isUnauthenticated(error)) set({ status: 'signedOut' });
        else set({ status: 'bootFailed', error });
      }
    },

    async signIn(role) {
      const session = start(await deps.login(role));
      tell({ type: 'signed-in', userId: session.user.id });
      return session;
    },

    async signOut() {
      if (state.status !== 'signedIn') return;
      // Other tabs first (D8-17): the server closes their sockets with 4401 right after logout.
      tell({ type: 'signed-out' });
      // End before logout, so the 401 an expired session gets from logout can't count as an expiry (AC-SHL-1.12).
      end('/login');
      try {
        await deps.logout();
      } catch {
        // Whatever logout returns (204, 401 or a network error), the user is signed out (SPEC-SHL-1).
      }
    },

    expire() {
      if (state.status !== 'signedIn') return; // D3-07: only a 401 after a successful boot is an expiry
      const returnTo = returnToFor(deps.location());
      tell({ type: 'expired' });
      end(loginUrl({ expired: true, returnTo }));
    },
  };
  return store;
}
