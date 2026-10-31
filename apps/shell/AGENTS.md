# apps/shell — local guide

**Purpose:** React host. Loads `/remotes.json`, registers remotes, boots the session (`getMe`), and renders login, the layout (permitted areas, user menu), the 403 page and one remote per route.

**Framework and key libraries:** React 19, React Router 8, TanStack Query 5, Zod 4, `@nimbus/auth`, `@nimbus/ui-kit`, `@module-federation/runtime` / `vite` (host, `hostInitInjectLocation: 'entry'`).

**Owns:** the browser URL (MF-1); the session store (`session.ts`) and one root bus per session (RT-10); the shell QueryClient (403 → toast); toasts for `toast:show`; the remote error panel (MF-4). From Day 4: `libs/realtime`, task center.

**Local commands:** `pnpm nx serve shell` (4200, proxies `/api` to 4000, serves `config/remotes.dev.json` at `/remotes.json`) · `pnpm nx run shell:test` · `pnpm nx run shell:build-e2e`.

**Local pitfalls**
- Don't put a `remotes.json` in `public/`: the gateway serves its own (SPEC.md §2.2).
- Keep `hostInitInjectLocation: 'entry'`; an inline init script would break the CSP `script-src 'self'`.
- *Retry* must re-register the remote with `force: true` (`remotes.ts`), or the runtime serves the cached failure.
- The session store never navigates: React Router 8 runs `navigate()` as a transition, so the router would render the old URL as signed out first. Put the target in `signedOut.redirect`; `App.tsx` follows it.
- Only 401s after a successful boot are expiries (D3-07); a boot 401 is "signed out", and sign-out ignores logout's 401.
- The toast region keeps an empty `role="alert"`; scope alert queries in tests to the page.
