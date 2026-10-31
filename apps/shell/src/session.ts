// The shell's session (SPEC-SHL-1). The session itself is the httpOnly cookie (ADR-0005); the shell only
// keeps the `Me` from login/getMe in memory and learns about expiry from a 401 or `session:expired`.
// Framework-free with injected dependencies, so every rule below is unit-tested (session.test.ts).
import type { QueryClient } from '@tanstack/react-query';
import { loginUrl, returnToFor } from '@nimbus/auth';
import type { Me, Role } from '@nimbus/api-client/model';
import type { RootBus, SessionSnapshot } from '@nimbus/mf-contract';

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
  let unsubscribeExpired: (() => void) | null = null;
  let realtime: { stop(): void } | null = null;

  const set = (next: SessionState) => {
    state = next;
    for (const listener of listeners) listener();
  };

  const start = (me: Me): SessionSnapshot => {
    const session = snapshotOf(me);
    const bus = deps.createBus(); // RT-10: one root bus per session
    unsubscribeExpired = bus.subscribe('session:expired', () => store.expire());
    set({ status: 'signedIn', session, bus });
    realtime = deps.startRealtime(bus); // after the state is signedIn, so a 4401 can expire it
    return session;
  };

  /**
   * Ends the in-memory session. Remotes unmount when the signed-in layout goes away; their caches go with
   * them. The store never navigates itself: React Router runs navigations as transitions, so the router
   * would render the old URL as signed out first. The router follows `redirect` instead (App.tsx).
   */
  const end = (redirect: string) => {
    unsubscribeExpired?.();
    unsubscribeExpired = null;
    realtime?.stop(); // closes with 1000, never reconnects (RT-10, D4-07)
    realtime = null;
    deps.queryClient.clear();
    // TODO(SPEC-SHL-7): tell other tabs.
    set({ status: 'signedOut', redirect });
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
      return start(await deps.login(role));
    },

    async signOut() {
      if (state.status !== 'signedIn') return;
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
      end(loginUrl({ expired: true, returnTo }));
    },
  };
  return store;
}
