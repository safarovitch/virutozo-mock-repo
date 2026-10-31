---
id: SPEC-SHL-7
title: "Multi-tab session"
area: shell
day: 8
implements: [US-1.1]
---

# SPEC-SHL-7 — Multi-tab session [MVP]

Shared rules: [mf-contract](../shared/mf-contract.md) · [realtime](../shared/realtime.md) · [rbac](../shared/rbac.md) · [url-conventions](../shared/url-conventions.md) · [messages-and-format](../shared/messages-and-format.md)

**Implements:** US-1.1 · NFR-SEC-3

**Behaviour:** The shell keeps tabs in sync over `BroadcastChannel('nimbus:session')`. Messages carry no secrets. Each tab keeps its own WebSocket (RT-1 is per tab).

| Message | Sent when | Every other tab |
|---|---|---|
| `{ type: 'signed-out' }` | *Sign out* clicked | unmount remotes, reset bus (RT-10), clear shell cache, go to `/login` |
| `{ type: 'expired' }` | this tab saw a 401 or close 4401 | same, with `/login?reason=expired` |
| `{ type: 'signed-in', userId }` | sign-in succeeded | different `userId` → full page reload; same user → refetch `/me` and call `update(ctx)` on mounted remotes |

- A tab on `/login` that receives `signed-in` refetches `/me` and navigates to its validated `returnTo` or the home area.
- On `signed-out` or `expired`, unsaved input (open wizard, dialogs) is **discarded without a prompt**. Security wins over convenience, and the user sees why via `/login?reason=…`.

E2E uses two pages in one Playwright browser context (shared cookies).

**Acceptance criteria**

| ID | Criterion | Status |
|---|---|---|
| **AC-SHL-7.1** | Signing out in tab A sends tab B to `/login` within 1 s, without user action. | `planned` |
| **AC-SHL-7.2** | Signing in as a different role in tab A makes tab B reload and show that role's areas and actions. | `planned` |
| **AC-SHL-7.3** | An expiry seen in tab A shows `errors.UNAUTHENTICATED` "Your session expired. Please sign in again." in tab B. | `planned` |
| **AC-SHL-7.4** | A tab on `/login` follows a sign-in in another tab. | `planned` |
