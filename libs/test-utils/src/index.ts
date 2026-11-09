// Test helpers for remotes and the shell (TECH-4): a bus that records what a remote publishes, and
// mountRemote(), which mounts any RemoteModule (React or Vue) the way the shell does.
import type { Permission } from '@nimbus/api-client/model';
import {
  createRootBus,
  type BusEventName,
  type BusEvents,
  type RemoteContext,
  type RemoteModule,
  type RemotePublishable,
  type RootBus,
  type ScopedBus,
  type SessionSnapshot,
} from '@nimbus/mf-contract';

export interface Published {
  type: RemotePublishable;
  payload: unknown;
  source: string;
}

export interface FakeBus {
  /** The scope a remote under test receives (`ctx.events`). */
  bus: ScopedBus & { dispose(): void };
  /** The root bus behind it (strict: a disallowed publish throws). */
  root: RootBus;
  /** Publish as the shell, e.g. `emit('server:vm.updated', { vm })`. */
  emit<K extends BusEventName>(type: K, payload: BusEvents[K]): void;
  /** Everything remotes published, oldest first. */
  published: Published[];
  /** Live subscriptions held by the scope (RT-7, AC-SHL-6.3). */
  subscriberCount(): number;
}

const REMOTE_EVENTS: RemotePublishable[] = ['task:started', 'toast:show', 'session:expired', 'remote:error'];

export function createFakeBus(source = 'test'): FakeBus {
  const root = createRootBus({ strict: true });
  const published: Published[] = [];
  for (const type of REMOTE_EVENTS) root.subscribe(type, (payload, meta) => published.push({ type, payload, source: meta.source }));
  return {
    bus: root.scope(source),
    root,
    emit: (type, payload) => root.publish(type, payload),
    published,
    subscriberCount: () => root.subscriberCount(source),
  };
}

/** A signed-in session with exactly these permissions. Pass values from the generated `Permission` enum (RBAC-6). */
export function testSession(permissions: readonly Permission[], overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    user: { id: 'u_test', name: 'Test User', email: 'test@example.com' },
    role: 'tenant_admin',
    tenant: { id: 't_acme', displayName: 'Acme Corp', planName: 'Business', status: 'active' },
    permissions,
    ...overrides,
  };
}

export interface MountedForTest {
  el: HTMLElement;
  ctx: RemoteContext;
  fake: FakeBus;
  navigate: { calls: [string, { replace?: boolean } | undefined][] };
  update(next: Partial<RemoteContext>): void;
  /** Unmounts, then disposes the scope like the shell does (MF-5). Returns the subscriptions left before dispose. */
  unmount(): number;
}

/** Mounts a remote into a fresh element in `document.body` with a recording bus and navigate. */
export function mountRemote(module: RemoteModule, ctx: Partial<RemoteContext> & { source?: string } = {}): MountedForTest {
  const { source = 'test', ...rest } = ctx;
  const fake = createFakeBus(source);
  const navigate: MountedForTest['navigate'] = { calls: [] };
  const el = document.createElement('div');
  document.body.append(el);
  let current: RemoteContext = {
    basePath: `/${source}`,
    path: '/',
    session: testSession([]),
    navigate: (to, options) => void navigate.calls.push([to, options]),
    events: fake.bus,
    ...rest,
  };
  const mounted = module.mount(el, current);
  return {
    el,
    get ctx() {
      return current;
    },
    fake,
    navigate,
    update(next) {
      current = { ...current, ...next };
      mounted.update(current);
    },
    unmount() {
      mounted.unmount();
      const left = fake.subscriberCount();
      fake.bus.dispose();
      el.remove();
      return left;
    },
  };
}
