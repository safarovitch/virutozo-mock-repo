# apps/shell — local guide

**Purpose:** React host. Loads `/remotes.json`, registers remotes with the MF runtime, renders the layout and mounts one remote per route.

**Framework and key libraries:** React 19, React Router 8, Zod 4, `@module-federation/runtime`, `@module-federation/vite` (host, `hostInitInjectLocation: 'entry'`).

**Owns:** the browser URL (MF-1); the root EventBus (one per session, RT-10); the remote error panel (MF-4). From Day 3: session, nav, task center; from Day 4: `libs/realtime`.

**Local commands:** `pnpm nx serve shell` (4200, proxies `/api` to 4000, serves `config/remotes.dev.json` at `/remotes.json`) · `pnpm nx run shell:test` · `pnpm nx run shell:build-e2e`.

**Local pitfalls**
- Don't put a `remotes.json` in `public/`: the gateway serves its own (SPEC.md §2.2).
- Keep `hostInitInjectLocation: 'entry'`; an inline init script would break the CSP `script-src 'self'`.
- *Retry* must re-register the remote with `force: true` (`remotes.ts`), or the runtime serves the cached failure.
- `session.ts` is an anonymous placeholder until SPEC-SHL-1 (Day 3).
