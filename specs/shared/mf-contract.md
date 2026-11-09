# Micro-frontend contract (`libs/mf-contract`)

Shared spec block (moved from SPEC.md §2.4). Rule IDs MF-1…MF-6 are defined only here.


Every remote exposes the same framework-agnostic interface so React and Vue remotes are interchangeable for the shell:

```ts
export interface RemoteContext {
  basePath: string;                 // e.g. "/compute"
  path: string;                     // current path below basePath, with search and hash, e.g. "/t_acme?tab=quotas"
  session: SessionSnapshot;         // user, tenant (TenantSummary | null), permissions[]
  navigate: (to: string, options?: { replace?: boolean }) => void; // shell owns the URL; replace = no new history entry
  events: ScopedBus;                // this remote's scope of the root bus ([realtime](./realtime.md))
}

export interface RemoteModule {
  mount(el: HTMLElement, ctx: RemoteContext): { unmount(): void; update(ctx: RemoteContext): void };
}
```

```ts
// plain frozen data derived from Me
import type { Role, Permission, TenantSummary } from '@nimbus/api-client/model'; // type-only (F11)

export interface SessionSnapshot {
  readonly user: { readonly id: string; readonly name: string; readonly email: string };
  readonly role: Role;                          // display only (RBAC-1)
  readonly tenant: Readonly<TenantSummary> | null;
  readonly permissions: readonly Permission[];
}
```

Permission checks use `can(snapshot, permission)` from `libs/auth`. On Day 1 the generated models don't exist yet, so `libs/mf-contract` uses minimal hand-made types marked `// TODO(TECH-2): replace with @nimbus/api-client/model`; TECH-2 swaps them for the generated types on Day 2.

`Role`, `Permission` and `TenantSummary` come from the generated contract models, so the snapshot changes when the contract changes. `libs/api-client` exposes them through a dedicated entry point, `@nimbus/api-client/model` (`package.json` `exports` → `src/generated/model/index.ts`), which contains types and enum constants only. `libs/mf-contract` imports them with `import type` only, so it has no runtime dependency on the API client; this is enforced by `@typescript-eslint/consistent-type-imports` and a dependency rule in `libs/mf-contract/eslint.config.mjs` that forbids value imports from `@nimbus/api-client`. Nx project graph: `mf-contract` → `api-client` (type-only).

`update(ctx)` must be implemented. Each remote keeps the context reactive (a ref provided via `provide`/`inject` in Vue, a context provider or store in React), and components read session, permissions and path from it. The shell calls `update` when the path under the remote's `basePath` changes, and on session changes only when `user.id`, `tenant` or `permissions` change (shallow comparison; SPEC-SHL-7).

Rules:
- **MF-1** The shell owns the browser URL. Remotes use memory routing, sync it to `ctx.path` on `mount` and `update`, and change it only through `ctx.navigate` (with `{ replace: true }` when the change must not add a history entry, see [url-conventions](./url-conventions.md)).
- **MF-2** Shared singletons: `react`, `react-dom`, `@tanstack/react-query`, `@nimbus/design-tokens`, and `@nimbus/ui-kit` for the React apps (shell, tenants, storage). Vue is shared only within the compute remote. The query **library** is shared; cache **instances** are not: every area (shell, tenants, storage, compute) creates its own `QueryClient`.
- **MF-3** Remotes never import from each other. Cross-remote communication only goes through `EventBus` with typed events.
- **MF-4** A remote that fails to load or throws shows a contained error panel with *Retry*; the rest of the shell keeps working.
- **MF-5** After `remote.unmount()`, the shell calls `dispose()` on that remote's bus scope, removing every subscription it still holds.
- **MF-6** Error boundaries live inside each remote, because a React remote renders into its own React root that the shell's boundary can't see. On `fatal: true` the shell unmounts the remote, disposes its scope and shows the MF-4 panel; `fatal: false` errors are only logged. The shell's own boundary covers load failures and a `mount()` that throws.
  - **React remotes** wrap their root in an `ErrorBoundary`. Render errors are published as `remote:error { fatal: true }`. Errors the boundary doesn't catch (event handlers, async work) are published with `fatal: false`.
  - **The Vue remote**'s root component is `<RemoteBoundary>`. It uses `onErrorCaptured` to catch **every** error raised inside Vue components (setup, render, lifecycle hooks, watchers, component event handlers), renders nothing further, publishes `remote:error { fatal: true }` and returns `false`. It never parses Vue's `info` string (a short code in production builds). Errors outside components (`window` `error` / `unhandledrejection` from compute code) are published with `fatal: false`.
  - **Accepted difference:** event-handler errors are non-fatal in React remotes and fatal in Vue. Both produce exactly one logger entry, and the user is never left with a silently broken view.
