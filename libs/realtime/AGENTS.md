# libs/realtime — local guide

**Purpose:** the only WebSocket client (RT-1): `createRealtimeClient` validates every message (RT-2), republishes it on the root bus as `server:<type>` (RT-3), and handles reconnects, close codes, the 45 s idle timeout and connection states (WS-1, WS-5…7). Also `mergeTask` / `isTerminal` for every task cache.

**Framework and key libraries:** none (framework-free). Generated Zod `EventsResponse` from `@nimbus/api-client/zod`, `@nimbus/logger`.

**Owns:** the backoff formula (D4-06), the client state machine, `eventsUrl()`, and the logger events `realtime.invalid_message` / `realtime.origin_rejected` / `realtime.idle_timeout` / `realtime.closed`.

**Local commands:** `pnpm nx run realtime:test` · `pnpm nx run realtime:typecheck`.

**Local pitfalls**
- One client per session: the shell's session store starts it on the new bus and calls `stop()` on sign-out or expiry (RT-10). Never reuse a stopped client.
- Close 4401, and 1006 when `checkSession()` resolves `false`, publish `session:expired`. Don't navigate from here; the shell redirects.
- `realtime:reconnected` only after an **open** connection was lost (RT-11). A failed first attempt doesn't count.
- Tests use a scripted fake socket and fake timers. `vi.waitFor` advances fake timers, so flush promises with `vi.advanceTimersByTimeAsync(0)` instead.
- Never log a message's payload: it can contain tenant data. Log only `type`.
