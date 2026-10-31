# Realtime, EventBus and WebSocket rules

Shared spec block (moved from SPEC.md §2.5 and SPEC.md §6.3). Rule IDs RT-1…RT-12 and WS-1…WS-7 are defined only here.


The browser tab has **one** WebSocket, owned by the shell. Remotes never see the socket; they only see the `ScopedBus` they receive in `RemoteContext`.

```
mock-api ──WS /api/events──▶ libs/realtime (inside shell)
                               │ 1. validate with generated Zod ServerEvent schema
                               │ 2. reconnect / backoff (WS-1), close codes (WS-5), status (WS-7)
                               ▼
                            root EventBus  ──scope('tenants' | 'storage' | 'compute')──▶ remotes
             ┌─────────────┬───────────────┼──────────────────┐
             ▼             ▼               ▼                  ▼
        shell           tenants (React)  storage (React)   compute (Vue)
   task center         tenants, quotas   buckets, quotas   VMs, VM tasks
```

**Why the shell owns it:** one connection per tab instead of three, and one place for auth (session cookie, NFR-SEC-3) and reconnect logic. Remotes stay simple: a remote only knows the bus, so it doesn't care whether events come from a WebSocket, a test or Storybook.

## Rules

| ID | Rule |
|---|---|
| RT-1 | Only `libs/realtime` may open a WebSocket. Remotes never do (lint: `nimbus/no-websocket-outside-realtime`). One socket per tab. |
| RT-2 | Every message is validated with the generated Zod `ServerEvent` schema. Invalid messages are dropped and logged (`realtime.invalid_message`), never forwarded. |
| RT-3 | Valid messages are published on the bus as `server:<type>` (e.g. `server:vm.updated`). `heartbeat` is not forwarded. |
| RT-4 | Ownership is the cache instance (MF-2). Any area may call any operation it has permission for and cache the result in **its own** client; no area touches another area's cache. Query keys always come from Orval's generated helpers (lint: `nimbus/no-handwritten-query-key`). Each area applies server events to its own cache as in the table below. |
| RT-5 | Consumers batch updates per animation frame before writing to the cache (WS-3). |
| RT-6 | On `realtime:reconnected`, each area invalidates only its own active queries, because events may have been missed (WS-2). |
| RT-7 | A remote removes every subscription, and cancels any pending frame, on `unmount()`. A test proves it. MF-5 removes anything it forgot. |
| RT-8 | An error thrown in one subscriber is caught and logged with the subscriber's scope. It never stops delivery to other subscribers. |
| RT-9 | `realtime:status` is sticky: a new subscriber immediately (synchronously) receives the latest value. That way a remote mounted later still shows the right connection state. |
| RT-10 | The root bus lives for **one session**. On sign-out or expiry, the shell unmounts remotes, disposes all scopes, closes the WebSocket and creates a **new** root bus, so sticky status and all subscriptions start fresh. |
| RT-11 | `realtime:reconnected` is published only after a connection that **follows** a lost one, never on the first connection of a session. |
| RT-12 | A session receives events about resources it can read, **plus** `tenant.updated` and `quota.updated` for its own tenant (`me.tenant.id`), even without `tenant:read`. Resellers receive events for their own tenants and providers for all. |

**What each area caches and which events it applies (RT-4):**

| Area | Caches | Applies |
|---|---|---|
| shell | `getMe`, `listTasks` (task center) | `server:task.updated` (via `mergeTask`); `server:tenant.updated` for the user's own tenant → patch `me.tenant.status` (SPEC-SHL-8) |
| tenants | `listTenants`, `getTenant`, `getQuotas`, `listTasks?resourceId=` (drawer Activity), `listPlans` | `server:tenant.updated`, `server:quota.updated`, `server:task.updated` for `resource.type = tenant` |
| storage | `listBuckets`, `getQuotas` (usage card), `listTenants` (admin tenant picker, SPEC-STO-3) | `server:quota.updated`, `server:bucket.updated` |
| compute | `listVms`, `getVm`, `getTask` for a VM's `activeTaskId` on mount, `listTasks?resourceId=` (VM drawer, SPEC-CMP-5), `listTenants` / `getTenant` (admin tenant picker and context line, SPEC-CMP-4) | `server:vm.updated` (batched per frame), `server:task.updated` for `resource.type = vm` |

## EventBus API (`libs/mf-contract/src/event-bus.ts`)

```ts
import type { Task, Vm, Tenant, TenantQuotas, Bucket } from '@nimbus/api-client/model'; // type-only

export interface BusEvents {
  // ── Shell → remotes: server events (RT-3) ──
  'server:task.updated':   { task: Task };
  'server:vm.updated':     { vm: Pick<Vm, 'id' | 'status' | 'ip' | 'activeTaskId'> };
  'server:tenant.updated': { tenant: Pick<Tenant, 'id' | 'status'> };
  'server:quota.updated':  { tenantId: string; quotas: TenantQuotas };
  'server:bucket.updated': { tenantId: string; bucket: Bucket | null; name: string }; // bucket null = deleted

  // ── Shell → remotes: connection lifecycle ──
  'realtime:status':      { state: 'connecting' | 'connected' | 'reconnecting' | 'offline'; attempt: number }; // sticky (RT-9)
  'realtime:reconnected': { downtimeMs: number };                                                             // RT-11

  // ── Remotes → shell ──
  'task:started':    { task: Task };                 // every task-producing 2xx response (SPEC-TSK-1)
  'toast:show':      { kind: 'success' | 'error' | 'info'; message: string; resource?: { type: string; id: string } };
  'session:expired': { source: string };             // remote got a 401 → shell redirects to /login?reason=expired
  'remote:error':    { remote: string; message: string; stack?: string; fatal: boolean }; // MF-6
}

export type BusEventName = keyof BusEvents;
export type RemotePublishable = 'task:started' | 'toast:show' | 'session:expired' | 'remote:error';

export interface ScopedBus {
  publish<K extends RemotePublishable>(type: K, payload: BusEvents[K]): void;
  subscribe<K extends BusEventName>(
    type: K,
    handler: (payload: BusEvents[K], meta: { source: string; ts: number }) => void,
  ): () => void; // returns unsubscribe
}

export interface RootBus {
  publish<K extends BusEventName>(type: K, payload: BusEvents[K]): void;
  subscribe: ScopedBus['subscribe'];
  scope(source: string): ScopedBus & { dispose(): void };
  subscriberCount(source: string): number; // for tests
}

export declare function createRootBus(): RootBus;
```

- The shell owns the root bus and passes each remote `rootBus.scope('<remote>')`.
- Remotes may only publish `RemotePublishable`. This is enforced by types, and at runtime: a disallowed publish throws in dev/test and is dropped and logged in production.
- Every delivery carries `meta.source`; subscriber errors are logged with the subscriber's scope (RT-8).

Notes on the catalogue:
- **Payloads come from the generated contract types.** If the contract changes `Vm`, the bus types change too, and TypeScript errors show every place that needs updating.
- **Toasts go through the shell**, so there's one `aria-live` region for the whole page. That's better for screen readers than one toast system per remote.
- **Delivery is synchronous and in-memory.** There's no replay except for the sticky `realtime:status`. A remote that mounts later loads fresh data through its queries anyway.
- **Changing the catalogue:** adding an event is safe. Changing a payload's shape means a new event name or an ADR, the same rule as breaking API changes (API-6).

## Task merging (`libs/realtime`)

Every task has a `seq` that increases with every change (`0` in the 201/202 response). Every place that caches tasks upserts through one function:

```ts
export function mergeTask(current: Task | undefined, incoming: Task): Task {
  if (!current) return incoming;
  if (isTerminal(current.status)) return current;           // succeeded/failed never revert
  return incoming.seq > current.seq ? incoming : current;   // stale or duplicate → ignored
}
```

A late `task:started` (`seq: 0`) can never overwrite newer progress, in any arrival order. Every task-producing response publishes `task:started` from the area that called it:

| Operation | Response | Publisher |
|---|---|---|
| `createTenant` | `201 TenantCreated { tenant, task }` | tenants (wizard) |
| `suspendTenant`, `resumeTenant` | `202 Task` | tenants |
| `runVmAction` | `202 Task` | compute |

## How it reaches the Vue remote

Mounting: the compute remote receives its scoped bus in `ctx`, provides it and a reactive context to all its components, and implements `update` ([mf-contract](./mf-contract.md)).

```ts
// apps/compute/src/mount.ts
import { createApp, shallowRef } from 'vue';
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';
import type { RemoteModule, RemoteContext } from '@nimbus/mf-contract';
import { configureApiClient } from '@nimbus/api-client';
import RemoteBoundary from './RemoteBoundary.vue';   // root: onErrorCaptured → remote:error { fatal: true } (MF-6)
import { BUS_KEY, CTX_KEY } from './realtime/bus';

export const mount: RemoteModule['mount'] = (el, initial) => {
  const ctx = shallowRef<RemoteContext>(initial);  // components read session, permissions and path from it
  const queryClient = new QueryClient();           // own cache instance (MF-2)
  configureApiClient({ onUnauthorized: () => ctx.value.events.publish('session:expired', { source: 'compute' }) });
  const app = createApp(RemoteBoundary);            // wraps App; never parses Vue's `info` string
  app.provide(BUS_KEY, initial.events);
  app.provide(CTX_KEY, ctx);
  app.use(VueQueryPlugin, { queryClient });
  // Errors outside components (window `error` / `unhandledrejection` from compute code) → remote:error { fatal: false }
  app.mount(el);
  return {
    unmount: () => app.unmount(),
    update: (next) => { ctx.value = next; },       // memory router syncs to next.path (MF-1)
  };
};
```

A composable that subscribes and cleans up automatically (RT-7):

```ts
// apps/compute/src/realtime/useBusEvent.ts
import { inject, onUnmounted } from 'vue';
import type { BusEventName, BusEvents, ScopedBus } from '@nimbus/mf-contract';
import { BUS_KEY } from './bus';

export function useBusEvent<K extends BusEventName>(type: K, handler: (p: BusEvents[K]) => void) {
  const bus = inject(BUS_KEY) as ScopedBus;
  const off = bus.subscribe(type, handler);
  onUnmounted(off);
}
```

Writing VM updates into the cache, batched per frame (RT-4, RT-5, RT-6, RT-7):

```ts
// apps/compute/src/realtime/useVmRealtime.ts
import { onUnmounted } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { useBusEvent } from './useBusEvent';
import { applyVmPatches, type VmPatch } from './vmPatches';

export function useVmRealtime() {
  const qc = useQueryClient();
  const pending = new Map<string, VmPatch>();   // last update per VM wins
  let frame = 0;

  const flush = () => {
    frame = 0;
    qc.setQueriesData({ queryKey: ['vms'] }, (page) => applyVmPatches(page, pending));
    pending.clear();
  };

  useBusEvent('server:vm.updated', ({ vm }) => {
    pending.set(vm.id, vm);
    if (!frame) frame = requestAnimationFrame(flush);   // 50 events in one frame → one cache write (AC-CMP-1.2)
  });

  useBusEvent('realtime:reconnected', () => qc.invalidateQueries({ queryKey: ['vms'] })); // AC-CMP-1.3

  onUnmounted(() => cancelAnimationFrame(frame));       // RT-7: no write after unmount
}
```

(`['vms']` stands for the key prefix from Orval's generated helper; RT-4 forbids hand-written keys in real code.)

## End to end: the user clicks *Reboot* in the Vue remote

1. Compute calls `runVmAction`, gets `202 { task }` (`seq: 0`), sets the row to `rebooting` optimistically and publishes `task:started`. The shell's task center shows it immediately (AC-TSK-1.1).
2. The mock API sends `task.updated` events with progress and increasing `seq`. The shell validates each one and publishes `server:task.updated`. The task center merges it into its own cache with `mergeTask`; compute merges `resource.type = vm` tasks into its own Vue cache the same way and shows the row's progress % (RT-4).
3. When the task finishes, the server sends `vm.updated` with status `running`. The shell publishes `server:vm.updated`, compute batches it into the next frame, and the row updates with no HTTP request (AC-CMP-1.1).
4. If the task failed, compute publishes `toast:show` with the mapped message for the task's `error.code` (MSG-3), and the shell shows it.

---


## WebSocket events (`/api/events`)


Connection: `ws(s)://<app origin>/api/events`. The browser sends the session cookie on the handshake; the server checks the session and the `Origin` header. Server → client messages are a discriminated union validated with Zod:

```ts
type ServerEvent =
  | { type: 'task.updated';   task: Task }
  | { type: 'vm.updated';     vm: Pick<Vm, 'id' | 'status' | 'ip' | 'activeTaskId'> }
  | { type: 'tenant.updated'; tenant: Pick<Tenant, 'id' | 'status'> }
  | { type: 'quota.updated';  tenantId: string; quotas: TenantQuotas }   // updateQuotas, bucket create/delete, plan change, every 60 s while usage changes
  | { type: 'bucket.updated'; tenantId: string; bucket: Bucket | null; name: string } // create, delete (null), size change
  | { type: 'heartbeat';      ts: string };
```

Rules:
- **WS-1** Client reconnects with exponential backoff (1s, 2s, 4s … max 30s) plus jitter.
- **WS-2** After reconnect, client refetches active queries (resync), because events may have been missed.
- **WS-3** Events update the TanStack Query cache directly (`setQueryData`); updates arriving faster than once per animation frame are batched. Who writes which cache, and how events reach remotes, is defined in [realtime](./realtime.md) (RT-1…9).
- **WS-4** Connection state is visible in the shell header (connected / reconnecting / offline), in an element with `role="status"` and name "Connection".
- **WS-5** Close codes (also in the contract's `x-close-codes`):

  | Code | Meaning | Client |
  |---|---|---|
  | 4401 | session missing, expired or signed out | don't reconnect → `session:expired` → `/login?reason=expired` |
  | 4403 | `Origin` rejected | don't reconnect → state `offline` → log error |
  | 4429 | too many connections | reconnect with backoff, minimum 30 s |
  | 1000 / 1001 | normal close / server going away | reconnect with backoff (WS-1) |
  | 1006 | network failure **or** HTTP 401 at the handshake (browsers can't tell them apart) | call `GET /api/me`: 401 → as 4401; otherwise reconnect with backoff |

  The server checks the session at upgrade and on every heartbeat tick (15 s). On expiry or sign-out it closes **all** of that session's sockets with 4401. A session may hold at most **5** WebSocket connections; the 6th is closed with 4429.
- **WS-6** With no message (including heartbeats) for 45 s, the client closes the socket and reconnects.
- **WS-7** Connection states: `connecting` → `connected`; on loss → `reconnecting`. It becomes `offline` after 5 consecutive failed attempts, when `navigator.onLine` is false, or on close 4403. While offline the client keeps retrying every 30 s (except after 4403). An `online` browser event triggers an immediate retry.
