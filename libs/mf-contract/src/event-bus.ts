// Typed EventBus: catalogue and root/scoped bus (specs/shared/realtime.md, MF-5, RT-8, RT-9).
import type { Bucket, Task, Tenant, TenantQuotas, Vm } from './model';

export interface BusEvents {
  // ── Shell → remotes: server events (RT-3) ──
  'server:task.updated': { task: Task };
  'server:vm.updated': { vm: Pick<Vm, 'id' | 'status' | 'ip' | 'activeTaskId'> };
  'server:tenant.updated': { tenant: Pick<Tenant, 'id' | 'status'> };
  'server:quota.updated': { tenantId: string; quotas: TenantQuotas };
  'server:bucket.updated': { tenantId: string; bucket: Bucket | null; name: string };

  // ── Shell → remotes: connection lifecycle ──
  'realtime:status': { state: 'connecting' | 'connected' | 'reconnecting' | 'offline'; attempt: number }; // sticky (RT-9)
  'realtime:reconnected': { downtimeMs: number };

  // ── Remotes → shell ──
  'task:started': { task: Task };
  'toast:show': { kind: 'success' | 'error' | 'info'; message: string; resource?: { type: string; id: string } };
  'session:expired': { source: string };
  'remote:error': { remote: string; message: string; stack?: string; fatal: boolean };
}

export type BusEventName = keyof BusEvents;
export type RemotePublishable = 'task:started' | 'toast:show' | 'session:expired' | 'remote:error';
export type BusMeta = { source: string; ts: number };
export type BusHandler<K extends BusEventName> = (payload: BusEvents[K], meta: BusMeta) => void;

export interface ScopedBus {
  publish<K extends RemotePublishable>(type: K, payload: BusEvents[K]): void;
  subscribe<K extends BusEventName>(type: K, handler: BusHandler<K>): () => void;
}

export interface RootBus {
  publish<K extends BusEventName>(type: K, payload: BusEvents[K]): void;
  subscribe<K extends BusEventName>(type: K, handler: BusHandler<K>): () => void;
  scope(source: string): ScopedBus & { dispose(): void };
  /** For tests (AC-SHL-6.3). */
  subscriberCount(source: string): number;
}

export interface RootBusOptions {
  /**
   * true (dev/test): a remote publishing an event outside RemotePublishable throws.
   * false (production): it's dropped and reported through onError.
   */
  strict?: boolean;
  /**
   * Called for subscriber errors (RT-8) and for dropped remote publishes (the error is a `BusPublishError`).
   * `subscriber` is the scope that threw or published. Defaults to console.error.
   */
  onError?: (error: unknown, info: { event: string; subscriber: string }) => void;
}

/** A remote published an event outside `RemotePublishable` (thrown in strict mode, reported otherwise). */
export class BusPublishError extends Error {
  override name = 'BusPublishError';
}

const REMOTE_PUBLISHABLE: ReadonlySet<string> = new Set<RemotePublishable>([
  'task:started',
  'toast:show',
  'session:expired',
  'remote:error',
]);
const STICKY: BusEventName = 'realtime:status';
const SHELL = 'shell';

interface Subscription {
  source: string;
  handler: (payload: unknown, meta: BusMeta) => void;
}

export function createRootBus(options: RootBusOptions = {}): RootBus {
  const strict = options.strict ?? true;
  const onError =
    options.onError ??
    ((error: unknown, info: { event: string; subscriber: string }) =>
      console.error(`[nimbus][${info.subscriber}] bus.subscriber_error ${info.event}`, error));
  const subscriptions = new Map<string, Set<Subscription>>();
  let sticky: { payload: unknown; meta: BusMeta } | undefined;

  function deliver(sub: Subscription, event: string, payload: unknown, meta: BusMeta) {
    try {
      sub.handler(payload, meta);
    } catch (error) {
      onError(error, { event, subscriber: sub.source }); // RT-8: never stops other subscribers
    }
  }

  function publishFrom(source: string, type: BusEventName, payload: unknown) {
    const meta: BusMeta = { source, ts: Date.now() };
    if (type === STICKY) sticky = { payload, meta };
    for (const sub of [...(subscriptions.get(type) ?? [])]) deliver(sub, type, payload, meta);
  }

  function subscribeFrom(source: string, type: BusEventName, handler: Subscription['handler']): () => void {
    const sub: Subscription = { source, handler };
    let set = subscriptions.get(type);
    if (!set) subscriptions.set(type, (set = new Set()));
    set.add(sub);
    if (type === STICKY && sticky) deliver(sub, type, sticky.payload, sticky.meta); // RT-9
    return () => {
      set.delete(sub);
    };
  }

  return {
    publish: (type, payload) => publishFrom(SHELL, type, payload),
    subscribe: (type, handler) => subscribeFrom(SHELL, type, handler as Subscription['handler']),
    scope(source) {
      return {
        publish(type, payload) {
          if (!REMOTE_PUBLISHABLE.has(type)) {
            const error = new BusPublishError(`Remote "${source}" may not publish "${type}"`);
            if (strict) throw error;
            onError(error, { event: type, subscriber: source });
            return;
          }
          publishFrom(source, type, payload);
        },
        subscribe: (type, handler) => subscribeFrom(source, type, handler as Subscription['handler']),
        dispose() {
          for (const set of subscriptions.values()) {
            for (const sub of set) if (sub.source === source) set.delete(sub);
          }
        },
      };
    },
    subscriberCount(source) {
      let n = 0;
      for (const set of subscriptions.values()) for (const sub of set) if (sub.source === source) n++;
      return n;
    },
  };
}
