// The only WebSocket client (RT-1). Validates every message (RT-2), republishes it on the root bus as
// `server:<type>` (RT-3), and owns reconnects (WS-1, D4-06), close codes (WS-5), the idle timeout (WS-6)
// and the connection state (WS-7, published as sticky `realtime:status`, RT-9).
import { EventsResponse } from '@nimbus/api-client/zod';
import type { ServerEvent } from '@nimbus/api-client/model';
import { createLogger, type Logger } from '@nimbus/logger';
import type { BusEvents, RootBus } from '@nimbus/mf-contract';

export type ConnectionState = BusEvents['realtime:status']['state'];

/** The subset of the browser WebSocket the client uses; tests pass a fake. */
export interface SocketLike {
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number }) => void) | null;
  close(code?: number, reason?: string): void;
}
export type SocketFactory = (url: string) => SocketLike;

export interface RealtimeOptions {
  bus: RootBus;
  url: string;
  createSocket?: SocketFactory;
  /** Close 1006 (WS-5): `GET /api/me`. Resolve `false` only for a 401; network errors count as "still signed in". */
  checkSession(): Promise<boolean>;
  logger?: Logger;
  random?: () => number;
  now?: () => number;
  /** `navigator.onLine` and the `online` / `offline` window events (WS-7). */
  network?: NetworkStatus;
}

export interface NetworkStatus {
  isOnline(): boolean;
  /** Calls `onChange(online)` on every `online` / `offline` event; returns an unsubscribe. */
  subscribe(onChange: (online: boolean) => void): () => void;
}

export interface RealtimeClient {
  start(): void;
  /** Sign-out or expiry (RT-10): closes with 1000 and never reconnects. */
  stop(): void;
  state(): ConnectionState;
}

export const CLOSE = { normal: 1000, abnormal: 1006, sessionEnded: 4401, originRejected: 4403, tooManyConnections: 4429 } as const;
export const IDLE_TIMEOUT_MS = 45_000; // WS-6
export const MAX_DELAY_MS = 30_000; // WS-1, WS-7 offline retry
export const OFFLINE_AFTER_FAILURES = 5; // WS-7

/** D4-06: attempt n waits min(30 s, 1 s · 2^(n−1)) × [0.8, 1.2), never more than 30 s. */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(MAX_DELAY_MS, 1000 * 2 ** Math.max(0, attempt - 1));
  return Math.min(MAX_DELAY_MS, Math.round(base * (0.8 + 0.4 * random())));
}

const browserSocket: SocketFactory = (url) => new WebSocket(url) as unknown as SocketLike;

const browserNetwork: NetworkStatus = {
  isOnline: () => typeof navigator === 'undefined' || navigator.onLine !== false,
  subscribe(onChange) {
    if (typeof window === 'undefined') return () => {};
    const on = () => onChange(true);
    const off = () => onChange(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  },
};

/** `ws(s)://<origin>/api/events` for the current page (same origin, ADR-0005). */
export function eventsUrl(location: { protocol: string; host: string }): string {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/events`;
}

export function createRealtimeClient(options: RealtimeOptions): RealtimeClient {
  const { bus, url } = options;
  const createSocket = options.createSocket ?? browserSocket;
  const log = options.logger ?? createLogger('realtime');
  const random = options.random ?? Math.random;
  const now = options.now ?? Date.now;
  const network = options.network ?? browserNetwork;

  let socket: SocketLike | null = null;
  let current: BusEvents['realtime:status'] = { state: 'connecting', attempt: 0 };
  let stopped = true;
  let everConnected = false;
  let lostAt: number | null = null; // set when an open connection is lost (RT-11)
  let failures = 0; // consecutive attempts that closed without opening (WS-7)
  let opened = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let unsubscribeNetwork: (() => void) | null = null;

  const setStatus = (state: ConnectionState, attempt: number) => {
    if (current.state === state && current.attempt === attempt) return;
    current = { state, attempt };
    bus.publish('realtime:status', current);
  };

  const clearTimers = () => {
    clearTimeout(retryTimer);
    clearTimeout(idleTimer);
    retryTimer = idleTimer = undefined;
  };

  const detach = (s: SocketLike | null) => {
    if (!s) return;
    s.onopen = s.onmessage = s.onclose = null;
  };

  const armIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      // WS-6: no message (not even a heartbeat) for 45 s. Close and reconnect like any other loss.
      log.warn('realtime.idle_timeout', { afterMs: IDLE_TIMEOUT_MS });
      const s = socket;
      detach(s);
      socket = null;
      s?.close(CLOSE.normal, 'idle timeout');
      lost(0);
    }, IDLE_TIMEOUT_MS);
  };

  const connect = () => {
    if (stopped) return;
    opened = false;
    const s = createSocket(url);
    socket = s;
    s.onopen = () => {
      opened = true;
      failures = 0;
      if (everConnected && lostAt !== null) bus.publish('realtime:reconnected', { downtimeMs: now() - lostAt }); // RT-11
      everConnected = true;
      lostAt = null;
      setStatus('connected', 0);
      armIdle();
    };
    s.onmessage = (event) => {
      armIdle();
      dispatch(event.data);
    };
    s.onclose = (event) => {
      detach(s);
      socket = null;
      clearTimeout(idleTimer);
      onClose(event.code);
    };
  };

  const dispatch = (data: unknown) => {
    let parsed: unknown;
    try {
      parsed = typeof data === 'string' ? JSON.parse(data) : undefined;
    } catch {
      parsed = undefined;
    }
    const result = EventsResponse.safeParse(parsed);
    if (!result.success) {
      // RT-2, AC-SHL-6.2: one entry per invalid message, with its type if it has one, never the payload.
      const type = typeof parsed === 'object' && parsed !== null && 'type' in parsed ? String(parsed.type) : undefined;
      log.error('realtime.invalid_message', type ? { type } : {});
      return;
    }
    publishServerEvent(bus, result.data as ServerEvent);
  };

  const onClose = (code: number) => {
    if (stopped) return;
    log.info('realtime.closed', { code, attempt: current.attempt });
    if (code === CLOSE.sessionEnded) return expire();
    if (code === CLOSE.originRejected) {
      // WS-5: no retries after 4403.
      log.error('realtime.origin_rejected');
      stopped = true;
      clearTimers();
      return setStatus('offline', current.attempt);
    }
    const minDelay = code === CLOSE.tooManyConnections ? MAX_DELAY_MS : 0;
    if (code === CLOSE.abnormal) {
      // 1006 is a network failure or a 401 at the handshake; browsers can't tell them apart (WS-5).
      void options.checkSession().then(
        (signedIn) => (signedIn ? lost(minDelay) : expire()),
        () => lost(minDelay),
      );
      return;
    }
    lost(minDelay);
  };

  const expire = () => {
    stop();
    bus.publish('session:expired', { source: 'realtime' }); // the shell redirects (AC-SHL-6.6)
  };

  /** A connection was lost or an attempt failed: schedule the next attempt (WS-1, WS-7). */
  const lost = (minDelay: number) => {
    if (stopped) return;
    if (opened) {
      lostAt ??= now(); // an open connection was lost
      failures = 0;
    } else {
      failures++; // an attempt closed without opening
    }
    opened = false;
    const attempt = failures + 1;
    const offline = failures >= OFFLINE_AFTER_FAILURES || !network.isOnline();
    setStatus(offline ? 'offline' : 'reconnecting', attempt);
    const delay = offline ? MAX_DELAY_MS : Math.max(minDelay, backoffDelay(attempt, random));
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, delay);
  };

  const onNetwork = (online: boolean) => {
    if (stopped) return;
    if (!online) {
      if (current.state !== 'connected') setStatus('offline', current.attempt);
      return;
    }
    // WS-7: an `online` event retries immediately.
    if (!socket) {
      clearTimeout(retryTimer);
      connect();
    }
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimers();
    unsubscribeNetwork?.();
    unsubscribeNetwork = null;
    const s = socket;
    detach(s);
    socket = null;
    s?.close(CLOSE.normal, 'session ended');
  };

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      bus.publish('realtime:status', current);
      unsubscribeNetwork = network.subscribe(onNetwork);
      connect();
    },
    stop,
    state: () => current.state,
  };
}

/** RT-3: `server:<type>` with the event minus its `type`; heartbeats aren't forwarded. */
function publishServerEvent(bus: RootBus, event: ServerEvent) {
  switch (event.type) {
    case 'heartbeat':
      return;
    case 'task.updated':
      return bus.publish('server:task.updated', { task: event.task });
    case 'vm.updated':
      return bus.publish('server:vm.updated', { vm: event.vm });
    case 'tenant.updated':
      return bus.publish('server:tenant.updated', { tenant: event.tenant });
    case 'quota.updated':
      return bus.publish('server:quota.updated', { tenantId: event.tenantId, quotas: event.quotas });
    case 'bucket.updated':
      return bus.publish('server:bucket.updated', { tenantId: event.tenantId, bucket: event.bucket, name: event.name });
  }
}
