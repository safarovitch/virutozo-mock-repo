# libs/mf-contract — local guide

**Purpose:** the framework-agnostic remote contract (`RemoteModule`, `RemoteContext`, `SessionSnapshot`) and the EventBus (`createRootBus`, scopes). Spec: `specs/shared/mf-contract.md`, `specs/shared/realtime.md`.

**Framework and key libraries:** none (pure TypeScript); tests with Vitest.

**Owns:** the bus catalogue `BusEvents` and `RemotePublishable`.

**Local commands:** `pnpm nx run mf-contract:test` · `pnpm nx run mf-contract:typecheck`.

**Local pitfalls**
- `src/model.ts` is hand-made until TECH-2 (D1-01); then use `import type` from `@nimbus/api-client/model` only, never a value import (F11).
- Changing a payload's shape needs a new event name or an ADR.
- Keep `createRootBus` free of framework and logger imports; errors go through `onError`.
