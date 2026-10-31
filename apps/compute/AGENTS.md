# apps/compute — local guide

**Purpose:** Vue 3 remote for the Compute area. Exposes `./mount` (ADR-0002); VM list, actions and detail arrive with SPEC-CMP-1/2/5 (Day 6).

**Framework and key libraries:** Vue 3.5 with `<script setup lang="ts">` and the Composition API, Pinia for UI state, `@tanstack/vue-query` via generated hooks (Day 2+). Vue and Vue Query are bundled here, not shared with the shell (ADR-0001 R2).

**Owns:** its own Vue Query client (VM caches, RT-4); the reactive context `CTX_KEY` (`src/context.ts`); its bus scope `BUS_KEY` and `useBusEvent` (`src/realtime/`).

**Local commands:** `pnpm nx serve compute` (4203) · `pnpm nx run compute:typecheck` (vue-tsc) · `pnpm nx run compute:build` · `pnpm nx run compute:test` (`mountRemote` from `@nimbus/test-utils`).

**Local pitfalls**
- Components read the context with `inject(CTX_KEY)`; `update(ctx)` only swaps the `shallowRef`.
- In templates, refs are unwrapped: write `ctx?.basePath`, not `ctx?.value.basePath`.
- Error handling uses `<RemoteBoundary>` with `onErrorCaptured` (MF-6); never parse Vue's `info` string.
- Subscribe only through `useBusEvent` inside a component's setup, so unmount removes it (RT-7, AC-SHL-6.3).
