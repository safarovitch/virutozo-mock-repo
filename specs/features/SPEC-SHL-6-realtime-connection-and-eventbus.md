---
id: SPEC-SHL-6
title: "Realtime connection and EventBus"
area: shell
day: 4
implements: [US-5.1, US-7.1]
---

# SPEC-SHL-6 — Realtime connection and EventBus [MVP]

Shared rules: [mf-contract](../shared/mf-contract.md) · [realtime](../shared/realtime.md) · [rbac](../shared/rbac.md) · [url-conventions](../shared/url-conventions.md) · [messages-and-format](../shared/messages-and-format.md)

**Implements:** US-5.1, US-7.1 · WS-1…7 · RT-1…12 ([realtime](../shared/realtime.md))

**Behaviour:** The shell's `libs/realtime` owns the only WebSocket, validates every message and republishes it on the root bus; each remote gets its own scope ([realtime](../shared/realtime.md)). Close codes, heartbeat timeout and connection states follow WS-5…WS-7.

**Acceptance criteria**

| ID | Criterion | Status |
|---|---|---|
| **AC-SHL-6.1** | Given a `provider_admin` who visits `/tenants`, `/compute` and `/storage` in one session, then exactly one WebSocket connection has been opened and one is open (e2e: count `page.on('websocket')` in Playwright). | `planned` |
| **AC-SHL-6.2** | An invalid message isn't published and creates exactly one `realtime.invalid_message` logger entry. | `planned` |
| **AC-SHL-6.3** | `subscriberCount('compute')` is 0 after compute unmounts. | `planned` |
| **AC-SHL-6.4** | (a) A subscriber added while the state is `reconnecting` receives `{ state: 'reconnecting' }` synchronously on subscribe (unit test). (b) The header element with `role="status"` and name `connections.label` "Connection" shows `connections.reconnecting` "Reconnecting…" (e2e; the server drops the caller's sockets via `POST /api/__test/drop-sockets`). | `planned` |
| **AC-SHL-6.5** | An exception in one subscriber doesn't stop other subscribers receiving the same event, and the logger entry names the failing subscriber's scope. | `planned` |
| **AC-SHL-6.6** | On close 4401, the client doesn't reconnect and the user lands on `/login?reason=expired` with `errors.UNAUTHENTICATED` "Your session expired. Please sign in again." | `planned` |
| **AC-SHL-6.7** | On close 1006, the client calls `/api/me`: 401 → as AC-SHL-6.6; 200 → reconnect with backoff. | `planned` |
| **AC-SHL-6.8** | With no message for 45 s, the client closes the socket and reconnects (unit test, fake timers). | `planned` |
| **AC-SHL-6.9** | After 5 failed attempts the header indicator shows `connections.offline` "Offline"; it shows `connections.connected` "Connected" again after a successful retry (unit test: a fake `WebSocket` that always fails, plus fake timers; e2e covers only `reconnecting`, AC-SHL-6.4). | `planned` |
| **AC-SHL-6.10** | Reloading `/login?reason=expired` still shows the expiry message. | `planned` |
| **AC-SHL-6.11** | A remote publishing `server:vm.updated` throws in tests and is dropped and logged in production builds. | `planned` |
| **AC-SHL-6.12** | After sign-out and sign-in, no subscription from the previous session receives events. | `planned` |
| **AC-SHL-6.13** | The first successful connection doesn't publish `realtime:reconnected`; a reconnection after a drop does, exactly once. | `planned` |
| **AC-SHL-6.14** | A tenant_admin's socket receives no events about other tenants (mock-api integration test). | `planned` |
| **AC-SHL-6.15** | A tenant_viewer's socket receives `tenant.updated` for `t_acme` and nothing for other tenants (mock-api integration test). | `planned` |
