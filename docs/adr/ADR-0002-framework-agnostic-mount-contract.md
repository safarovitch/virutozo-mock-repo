# ADR-0002 — Framework-agnostic `mount(el, ctx)` remote contract

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Rasul Idiev
- **Related:** ADR-0001 R1, `specs/shared/mf-contract.md` (MF-1…MF-6), `libs/mf-contract`, TECH-1

## Context

The shell is React; two remotes are React and one (Compute) is Vue 3. The shell must load, mount, update and unmount every remote the same way, and a remote must not depend on the shell's framework, router or query client. This is also the migration path for a large Vue application toward micro-frontends: Vue areas can move behind the same contract one at a time.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **A. Each remote exposes `./mount` with `mount(el, ctx) → { unmount, update }`** | Framework-agnostic; React and Vue remotes look identical to the shell; context changes without remounting; easy to test with a mount harness | Each remote writes a few lines of glue (createRoot / createApp) |
| B. Expose React components and wrap Vue with a React adapter | Natural for React remotes | Couples the shell to React; the Vue remote needs a bridge library; every remote shares the shell's render tree, so one remote's render error can break the shell |
| C. Web Components (`customElements.define`) | Standard, framework-neutral | Passing rich context (session, bus, navigate) through attributes/properties is awkward; shadow DOM complicates shared design tokens and focus management |

## Decision

**Option A.** Every remote exposes exactly one module, `./mount`, implementing `RemoteModule` from `libs/mf-contract`:

- `mount(el, ctx)` renders into its own root inside `el` and returns `{ unmount(), update(ctx) }`.
- `RemoteContext` carries `basePath`, `path`, `session` (`SessionSnapshot`), `navigate(to, { replace })` and `events` (the remote's scope of the root EventBus).
- The shell owns the URL; remotes use memory routing synced to `ctx.path` and change it only through `ctx.navigate` (MF-1).
- `update(ctx)` must be implemented; components read session, permissions and path from a reactive context, so updates never remount.
- After `unmount()` the shell disposes the remote's bus scope (MF-5). Error boundaries live inside each remote (MF-6); the shell's own panel covers load failures and a `mount()` that throws (MF-4).

## Consequences

- **Positive:** the shell can't tell React and Vue remotes apart; remotes are isolated render roots, so a failure stays contained; `mountRemote(module, ctx)` in `libs/test-utils` can test any remote the same way.
- **Negative:** each remote needs mount glue and a reactive context wrapper; cross-remote UI composition (a component from one remote inside another) isn't possible by design (MF-3).
- **Day 1 note:** the context's model types are hand-made until TECH-2 generates them from the contract (D1-01).
