import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '@nimbus/api-client/model';
import { clearLogEntries, logEntries } from '@nimbus/logger';
import { createRootBus, type BusEvents } from '@nimbus/mf-contract';
import { backoffDelay, createRealtimeClient, IDLE_TIMEOUT_MS, type NetworkStatus, type SocketLike } from './client';

/** A scripted WebSocket: tests open, message and close it by hand. */
class FakeSocket implements SocketLike {
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  closedWith: number | undefined;
  constructor(readonly url: string) {}
  open() {
    this.onopen?.({});
  }
  send(data: unknown) {
    this.onmessage?.({ data: typeof data === 'string' ? data : JSON.stringify(data) });
  }
  drop(code: number) {
    this.onclose?.({ code });
  }
  close(code?: number) {
    this.closedWith = code;
  }
}

const task: Task = {
  id: 'task_1',
  kind: 'vm.reboot',
  status: 'running',
  progress: 40,
  seq: 2,
  resource: { type: 'vm', id: 'vm_01', name: 'web-01' },
  tenantId: 't_acme',
  error: null,
  createdAt: '2026-10-31T10:00:00Z',
  finishedAt: null,
};

function setup(overrides: { checkSession?: () => Promise<boolean>; online?: boolean } = {}) {
  const bus = createRootBus();
  const sockets: FakeSocket[] = [];
  let online = overrides.online ?? true;
  let networkListener: ((online: boolean) => void) | undefined;
  const network: NetworkStatus = {
    isOnline: () => online,
    subscribe(cb) {
      networkListener = cb;
      return () => (networkListener = undefined);
    },
  };
  const checkSession = vi.fn(overrides.checkSession ?? (async () => true));
  const client = createRealtimeClient({
    bus,
    url: 'ws://app.test/api/events',
    createSocket: (url) => {
      const s = new FakeSocket(url);
      sockets.push(s);
      return s;
    },
    checkSession,
    random: () => 0.5, // jitter factor 1.0
    network,
  });
  const statuses: BusEvents['realtime:status'][] = [];
  bus.subscribe('realtime:status', (s) => statuses.push(s));
  const last = () => sockets[sockets.length - 1] as FakeSocket;
  const setOnline = (value: boolean) => {
    online = value;
    networkListener?.(value);
  };
  return { bus, client, sockets, last, statuses, checkSession, setOnline };
}

beforeEach(() => {
  vi.useFakeTimers();
  clearLogEntries();
});
afterEach(() => vi.useRealTimers());

describe('createRealtimeClient', () => {
  it('TECH-4: publishes valid events as server:<type> and does not forward heartbeats (RT-3)', () => {
    const { bus, client, last } = setup();
    const seen: string[] = [];
    bus.subscribe('server:task.updated', ({ task: t }) => seen.push(`task ${t.id}`));
    bus.subscribe('server:vm.updated', ({ vm }) => seen.push(`vm ${vm.id}`));
    client.start();
    last().open();
    last().send({ type: 'heartbeat', ts: '2026-10-31T10:00:00Z' });
    last().send({ type: 'task.updated', task });
    last().send({ type: 'vm.updated', vm: { id: 'vm_01', status: 'running', ip: '10.0.0.1', activeTaskId: null } });
    expect(seen).toEqual(['task task_1', 'vm vm_01']);
  });

  it('AC-SHL-6.2: an invalid message is not published and creates exactly one realtime.invalid_message entry', () => {
    const { bus, client, last } = setup();
    const handler = vi.fn();
    bus.subscribe('server:task.updated', handler);
    client.start();
    last().open();
    last().send({ type: 'task.updated', task: { ...task, progress: 'lots' } });
    expect(handler).not.toHaveBeenCalled();
    const entries = logEntries().filter((e) => e.event === 'realtime.invalid_message');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ level: 'error', source: 'realtime', data: { type: 'task.updated' } });
  });

  it('AC-SHL-6.2: a message that is not JSON is dropped and logged once', () => {
    const { client, last } = setup();
    client.start();
    last().open();
    last().onmessage?.({ data: '{not json' });
    expect(logEntries().filter((e) => e.event === 'realtime.invalid_message')).toHaveLength(1);
  });

  it("AC-SHL-6.6: on close 4401 the client doesn't reconnect and publishes session:expired", () => {
    const { bus, client, sockets, last } = setup();
    const expired = vi.fn();
    bus.subscribe('session:expired', expired);
    client.start();
    last().open();
    last().drop(4401);
    vi.advanceTimersByTime(120_000);
    expect(sockets).toHaveLength(1);
    expect(expired).toHaveBeenCalledWith({ source: 'realtime' }, expect.objectContaining({ source: 'shell' }));
  });

  it('AC-SHL-6.7: on close 1006 with /api/me answering 401 the session expires without reconnecting', async () => {
    const { bus, client, sockets, last, checkSession } = setup({ checkSession: async () => false });
    const expired = vi.fn();
    bus.subscribe('session:expired', expired);
    client.start();
    last().open();
    last().drop(1006);
    await vi.advanceTimersByTimeAsync(0); // settle checkSession()
    expect(expired).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(120_000);
    expect(checkSession).toHaveBeenCalledTimes(1);
    expect(sockets).toHaveLength(1);
  });

  it('AC-SHL-6.7: on close 1006 with /api/me answering 200 the client reconnects with backoff', async () => {
    const { client, sockets, last, statuses } = setup();
    client.start();
    last().open();
    last().drop(1006);
    await vi.advanceTimersByTimeAsync(0); // settle checkSession()
    expect(statuses.at(-1)).toEqual({ state: 'reconnecting', attempt: 1 });
    vi.advanceTimersByTime(999);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);
  });

  it('AC-SHL-6.8: with no message for 45 s the client closes the socket and reconnects', () => {
    const { client, sockets, last } = setup();
    client.start();
    last().open();
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1000);
    last().send({ type: 'heartbeat', ts: '2026-10-31T10:00:00Z' }); // any message re-arms the timer
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1);
    expect(sockets[0]?.closedWith).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(sockets[0]?.closedWith).toBe(1000);
    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(2);
  });

  it('AC-SHL-6.9: after 5 failed attempts the state is offline, and connected again after a successful retry', async () => {
    const { client, last, statuses } = setup();
    client.start();
    last().open();
    last().drop(1001);
    for (let attempt = 1; attempt <= 5; attempt++) {
      expect(statuses.at(-1)).toEqual({ state: 'reconnecting', attempt });
      vi.advanceTimersByTime(backoffDelay(attempt, () => 0.5));
      last().drop(1001); // the attempt fails before opening
    }
    expect(statuses.at(-1)?.state).toBe('offline');
    vi.advanceTimersByTime(30_000); // offline: retry every 30 s
    last().open();
    expect(statuses.at(-1)).toEqual({ state: 'connected', attempt: 0 });
  });

  it("AC-SHL-6.13: the first connection doesn't publish realtime:reconnected; a reconnection after a drop does, exactly once", () => {
    const { bus, client, last } = setup();
    const reconnected = vi.fn();
    bus.subscribe('realtime:reconnected', reconnected);
    client.start();
    last().drop(1001); // the very first attempt fails: still no lost connection
    vi.advanceTimersByTime(2000);
    last().open();
    expect(reconnected).not.toHaveBeenCalled();
    last().drop(1001);
    vi.advanceTimersByTime(1000);
    last().drop(1001);
    vi.advanceTimersByTime(2000);
    last().open();
    expect(reconnected).toHaveBeenCalledTimes(1);
    expect(reconnected.mock.calls[0]?.[0]).toEqual({ downtimeMs: 3000 });
  });

  it('TECH-4: backoff is 1 s, 2 s, 4 s … capped at 30 s, with ±20 % jitter (WS-1, D4-06)', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => backoffDelay(n, () => 0.5))).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
    expect(backoffDelay(1, () => 0)).toBe(800);
    expect(backoffDelay(1, () => 0.999)).toBe(1200);
    expect(backoffDelay(6, () => 0.999)).toBe(30000);
  });

  it('TECH-4: close 4429 waits at least 30 s before reconnecting (WS-5)', () => {
    const { client, sockets, last } = setup();
    client.start();
    last().open();
    last().drop(4429);
    vi.advanceTimersByTime(29_999);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);
  });

  it('TECH-4: close 4403 goes offline, logs realtime.origin_rejected and never retries (WS-5)', () => {
    const { client, sockets, last, statuses } = setup();
    client.start();
    last().drop(4403);
    vi.advanceTimersByTime(300_000);
    expect(sockets).toHaveLength(1);
    expect(statuses.at(-1)?.state).toBe('offline');
    expect(logEntries().some((e) => e.event === 'realtime.origin_rejected')).toBe(true);
  });

  it('TECH-4: offline while navigator.onLine is false; an online event retries immediately (WS-7)', () => {
    const { client, sockets, last, statuses, setOnline } = setup();
    client.start();
    last().open();
    setOnline(false);
    last().drop(1001);
    expect(statuses.at(-1)?.state).toBe('offline');
    setOnline(true);
    expect(sockets).toHaveLength(2);
    last().open();
    expect(statuses.at(-1)?.state).toBe('connected');
  });

  it('TECH-4: stop() closes with 1000 and never reconnects (RT-10)', () => {
    const { client, sockets, last } = setup();
    client.start();
    last().open();
    client.stop();
    expect(sockets[0]?.closedWith).toBe(1000);
    vi.advanceTimersByTime(300_000);
    expect(sockets).toHaveLength(1);
  });

  it('TECH-4: realtime:status goes connecting → connected and is sticky for later subscribers (RT-9)', () => {
    const { bus, client, last, statuses } = setup();
    client.start();
    expect(statuses).toEqual([{ state: 'connecting', attempt: 0 }]);
    last().open();
    const late = vi.fn();
    bus.subscribe('realtime:status', late);
    expect(late).toHaveBeenCalledWith({ state: 'connected', attempt: 0 }, expect.anything());
  });
});
