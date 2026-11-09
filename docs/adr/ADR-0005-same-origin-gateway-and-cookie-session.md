# ADR-0005 — Same-origin gateway and httpOnly cookie session

- **Status:** Accepted
- **Date:** 2026-10-30
- **Deciders:** Rasul Idiev
- **Related:** SPEC.md §2.2, NFR-SEC-1, NFR-SEC-3, NFR-SEC-6, SPEC-SHL-1, SPEC-SHL-7, WS-5; `docs/decisions/SPEC-REVIEW-v1.3-decisions.md` (D1), `docs/decisions/SPEC-REVIEW-v1.4-decisions.md` (E1, E5, E8, E12)

## Context

1. Deep links and page reloads must keep the user signed in (SPEC-SHL-1).
2. No session secret may be readable by JavaScript or stored in `localStorage`, `sessionStorage` or IndexedDB (AGENTS.md H8).
3. The shell (4200), the remotes (4201–4203) and mock-api (4000) run on different ports, which are different origins. Cross-origin credentialed requests need CORS, and the preview deploy would have put the shell and the API on different sites, where `SameSite=Strict` cookies are never sent.
4. CI e2e must not depend on Vite preview ports that nothing pins down.
5. Browsers don't expose a WebSocket handshake's HTTP status, so the socket needs its own way to report an expired session.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **A. Same-origin gateway + httpOnly `Secure; SameSite=Strict` cookie, CSRF header and `Origin` check** | Reload-safe; no secret in JS; no CORS; one URL for CI, preview and demo; strict cookie works because everything is same-site | One more app (`apps/gateway`) to build and run |
| B. In-memory bearer token (v1.1) | Simple; no CSRF surface | A reload signs the user out; deep links lose the session |
| C. Cross-site cookies (`SameSite=None; Secure`) with CSRF tokens and credentialed CORS | Keeps separate origins and hosts | CSRF token plumbing, CORS allowlists per environment, third-party-cookie restrictions in browsers, preview and e2e origins to keep in sync |

## Decision

**Option A.**

- **Gateway** (`apps/gateway`, Fastify + `@fastify/static` + `@fastify/http-proxy`, port **8080**) serves `/` (shell), `/remotes/<name>/` (remotes) and proxies `/api/*`, including the `/api/events` WebSocket upgrade, to mock-api. CI e2e, preview and the demo always use the gateway. Any other `GET`/`HEAD` that accepts `text/html` gets the shell's `index.html` (SPA fallback), but missing files under `/remotes/` return 404 and never fall back (SPEC.md §2.2).
- **Development:** the shell's Vite dev server (4200) proxies `/api` (`ws: true`) to mock-api, so the API is same-origin in dev too. Remotes load from their own dev servers (4201–4203); that traffic is static code only, without credentials.
- **Cookie:** `nimbus_session` with `HttpOnly; Secure; SameSite=Strict; Path=/api`, set by `POST /api/login` (which returns `Me`), cleared by `POST /api/logout`. Chromium treats `http://localhost` as secure, so this works locally; other browsers are covered by the HTTPS nightly suite (below).
- **CSRF:** every mutating request to an authenticated endpoint carries `X-Nimbus-Csrf: 1` (added by `customFetch`). The server rejects mutating requests and WebSocket upgrades whose `Origin` isn't an app origin (403 / close 4403). The only exemption is `reportVitals`, sent with `navigator.sendBeacon`, which can't set headers; it's unauthenticated, append-only, `Origin`-checked, rate-limited (60/min per IP) and size-limited (16 KB).
- **WebSocket connections:** at most 5 per session; the 6th is closed with 4429.
- **No CORS anywhere.** The client sets `credentials: 'same-origin'` explicitly; the server sends no `Access-Control-Allow-*` headers.
- **Expiry** is detected only by a 401 or WebSocket close 4401 (WS-5). The client never tracks an expiry time; `Session.expiresAt` is removed from the contract.
- **Preview deploy** (stretch) is one container (gateway + mock-api + built assets) on a single host. GitHub Pages is dropped.
- **Browsers:** PR e2e runs on Chromium over `http://localhost:8080`, where `Secure` cookies work. The nightly cross-browser suite (Chromium, Firefox, WebKit) runs over `https://localhost:8443` (gateway with `TLS=1` and a self-signed cert), so `Secure` cookies behave the same in WebKit.

## Consequences

- **Positive:** sessions survive reloads and deep links; no session secret in JavaScript; no CORS configuration; e2e runs against one fixed origin.
- **Negative:** the gateway is another moving part in CI and the demo. Each remote's `remoteEntry.js` URL differs between dev (own port) and gateway (path), so the runtime manifest (ADR-0001 R3) is environment-specific.
- **Resolved in v1.4:** the `reportVitals` CSRF exemption (E5) and the per-session socket limit (E12) are decided above.
