# ADR-0004 — TanStack Query for server state; WebSocket events write into the query cache

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Rasul Idiev
- **Related:** `specs/shared/realtime.md` (RT-1…12, WS-1…7), `specs/shared/mf-contract.md` (MF-2, MF-5), SPEC-SHL-6, SPEC-TSK-1, TECH-4, `libs/realtime`, `docs/decisions/2026-10-31-day-4-decisions.md`

## Context

Every area shows server data that also changes on the server: VM status, task progress, quotas, buckets. The data arrives two ways, over HTTP (generated Orval hooks) and as WebSocket events. If events go to a separate client-side store, every screen has to reconcile two copies of the same data. That brings stale rows after a refetch, and progress that jumps backwards when an old HTTP response lands after a newer event. The areas are also separate micro-frontends (React and Vue), so whatever holds the data must not be shared between them.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **A. TanStack Query is the only server-state store; events patch the query cache** | One copy of each resource; the generated hooks, loading/error states and refetch come for free; works the same in React and Vue Query | Each area has to write small cache patchers; patching paginated or infinite data needs care |
| B. A global client store (Redux, Pinia) filled from both HTTP and events | Explicit reducers | A second source of truth next to the query cache; it would need to be shared across remotes, which conflicts with MF-2 |
| C. Events only invalidate queries (always refetch) | Simplest | An HTTP request per event: 50 VM updates a second become 50 refetches; progress bars stutter |

## Decision

**Option A.**

- Each area (shell, tenants, storage, compute) creates its **own** `QueryClient` (MF-2). Only the query library is shared, never a cache instance.
- `libs/realtime` owns the only socket (RT-1). It validates each message with the generated Zod `ServerEvent` schema (RT-2) and publishes it on the root bus as `server:<type>` (RT-3). Every remote gets its own scope of that bus.
- Each area applies the events it cares about to **its own** cache with `setQueryData` / `setQueriesData`, using query keys from Orval's generated helpers (RT-4), batched per animation frame where events come fast (RT-5).
- Tasks are merged through `mergeTask` everywhere (seq-based, terminal states never revert). That includes HTTP refetches: the task center's `queryFn` merges the fresh list into what is already cached, item by item, instead of replacing it (D4-09).
- After a reconnect (`realtime:reconnected`, only after a lost connection, RT-11), each area invalidates its own active queries, because events may have been missed (RT-6).
- One realtime client and one root bus per session (RT-10). Sign-out or expiry stops the client (close 1000, no reconnect) before the bus is replaced, so nothing from the old session reaches the new one.

## Consequences

- **Positive:** a screen reads one cache, so loading, error and live updates are one code path. A late HTTP response can't undo newer progress. Remotes can be tested with a fake bus (`libs/test-utils`) and no socket.
- **Negative:** every area writes small patch functions per event, and has to keep them in line with the generated types. TypeScript catches shape changes, but not missed events. Patching virtualised infinite lists (tenants, Day 5) needs care, because `setQueriesData` touches every cached page.
- **Follow-ups:** the lint rules `nimbus/no-websocket-outside-realtime` and `nimbus/no-handwritten-query-key` (TECH-10, Day 9) enforce RT-1 and RT-4 mechanically. Until then, review enforces them.
