---
id: SPEC-SHL-1
title: "Sign in and session"
area: shell
day: 3
implements: [US-1.1]
---

# SPEC-SHL-1 — Sign in and session [MVP]

Shared rules: [mf-contract](../shared/mf-contract.md) · [realtime](../shared/realtime.md) · [rbac](../shared/rbac.md) · [url-conventions](../shared/url-conventions.md) · [messages-and-format](../shared/messages-and-format.md)

**Implements:** US-1.1

**Behaviour**
- Demo login page with a role picker (4 roles) and a *Sign in* button.
- The session is the `nimbus_session` cookie (`HttpOnly; Secure; SameSite=Strict; Path=/api`) set by `login` (NFR-SEC-3, NFR-SEC-6, ADR-0005). JavaScript never reads it; the shell keeps only the `Me` returned by `login` / `getMe` in memory. Expiry is detected only by a 401 or WebSocket close 4401 (WS-5); the client never tracks an expiry time.
- **Home area** = the first permitted area in this order: Tenants → Compute → Storage. With the [rbac](../shared/rbac.md) matrix, provider and reseller admins get `/tenants`; tenant roles get `/compute`. `/` always redirects to the home area.
- **Boot:** on every page load the shell calls `getMe` before rendering any route. While it's pending, it shows a full-page loader (no protected content, AC-SHL-3.3). `200` → render the requested URL. `401` → go to `/login?returnTo=<requested path + query>`.
- **Sign in:** `login` returns `Me`. The shell drops `reason` and `returnTo` from the URL and navigates to `returnTo` if it's valid, otherwise to the home area. Validation: `const u = new URL(returnTo, location.origin)`; valid only if `u.origin === location.origin`, then navigate to `u.pathname + u.search + u.hash`. Permission for the target route is checked after navigation as usual (RBAC-5), so a deep link the user can't access shows the 403 page.
- **Session expired:** any 401 (shell, or `session:expired` from a remote) or WebSocket close 4401 sends the user to `/login?reason=expired&returnTo=<current path>`. The login page shows `errors.UNAUTHENTICATED` whenever `reason=expired` is present, so the message survives a reload of `/login`. Other tabs follow (SPEC-SHL-7).
- *Sign out* calls `logout` and then, whatever it returns (204, 401 or a network error), clears the in-memory session and the shell's query client, unmounts remotes (their clients go with them), closes the WebSocket, starts a new root bus (RT-10), tells other tabs (SPEC-SHL-7) and returns to `/login` (no `returnTo`).

**Acceptance criteria**

| ID | Criterion | Status |
|---|---|---|
| **AC-SHL-1.1** | Given a `tenant_viewer`, when they sign in, then they land on `/compute`. | `done` |
| **AC-SHL-1.2** | Given a `provider_admin`, when they sign in, then they land on `/tenants`. | `done` |
| **AC-SHL-1.3** | Given any signed-in user, when they sign out, then they land on `/login`, browser *Back* stays on `/login`, and after signing in as `tenant_viewer` no tenant rows from the previous session are shown. (Unit test: sign-out clears the shell's query client; remote clients go away with unmount.) | `done` |
| **AC-SHL-1.4** | Given the session expires (API returns 401; e2e uses `POST /api/__test/expire-session`), then the user is redirected to `/login?reason=expired&returnTo=<current path>` and sees `errors.UNAUTHENTICATED` "Your session expired. Please sign in again." | `done` |
| **AC-SHL-1.5** | Given a signed-in `tenant_admin` or `tenant_viewer`, when they open `/`, then they are redirected to `/compute`. | `done` |
| **AC-SHL-1.6** | Given a signed-in `provider_admin` on `/tenants/t_acme?status=active`, or a signed-in `tenant_admin` on `/compute`, when they reload the page, then they stay signed in on the same URL, with no visit to `/login`. | `done` |
| **AC-SHL-1.7** | Given a signed-out user, when they open `/tenants/t_acme?status=active` and sign in as `provider_admin`, then they land on `/tenants/t_acme?status=active`. | `done` |
| **AC-SHL-1.8** | Given `/login?returnTo=<input>`, when the user signs in as `provider_admin`, then: `/tenants?status=active` → they land on it; `//evil.example`, `/\evil.example`, `https://evil.example/x` and `javascript:alert(1)` → rejected, they land on `/tenants`; `/%2F%2Fevil.example` → they stay on the app origin (that literal path). | `done` |
| **AC-SHL-1.9** | After sign-in, `context.cookies()` shows `nimbus_session` with `httpOnly: true`, `secure: true`, `sameSite: 'Strict'`, `path: '/api'`, and `localStorage` / `sessionStorage` contain no value equal to the cookie's value. | `done` |
| **AC-SHL-1.10** | A mutating request without `X-Nimbus-Csrf`, or with a foreign `Origin`, gets 403 `FORBIDDEN` (mock-api integration test). | `done` |
| **AC-SHL-1.12** | Signing out after the session already expired still lands on `/login` with no error shown. | `done` |
| **AC-SHL-1.13** | Reloading `/tenants/t_acme?tab=quotas` through the gateway (as `provider_admin`) shows the same view. | `done` |
| **AC-SHL-1.14** | A request for a missing file under `/remotes/storage/` returns 404, not `index.html`. | `done` |
