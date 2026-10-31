# Nimbus Console — Product & Engineering Spec

> **What this is.** A demo repository spec for a mock multi-tenant cloud admin portal, built to show the exact workflow of a spec-first, contract-first, agent-assisted frontend team.
> **Who reads it.** Humans *and* coding agents. Every requirement has a stable ID; every test, PR and commit references the IDs it implements.
> **Status:** v1.5 · Owner: Rasul Idiev · Last updated: 2026-10-30
> **v1.1 changes:** full contract in `contracts/main.tsp` replaces the §6.2 excerpt; Vite MF tooling and versions fixed by ADR-0001; seed data, plans and error messages moved to `specs/mock-data.md`; AC-TEN-1.1 made measurable.
> **v1.2 changes:** tenant roles lose `tenant:read`; their home is `/compute` (§5.2, SPEC-SHL-1). Session moves to an httpOnly cookie so reloads and deep links survive sign-in (NFR-SEC-3, ADR-0005, AC-SHL-1.5…1.8, contract `login`/`logout`/`events`). Every AC carries a status; engineering work gets `TECH-*` IDs; `trace:check` rules T1–T6 replace the old "every AC has a test" rule (§3, §14). New §2.5 defines WebSocket ownership and the EventBus catalogue (RT-1…9), with ACs in SPEC-SHL-6.
> **v1.3 changes:** applies `docs/decisions/SPEC-REVIEW-v1.3-decisions.md` (D1–D15): same-origin gateway, cookie + CSRF session (ADR-0005); multi-tab session (SPEC-SHL-7); WebSocket close codes and states (WS-5…7); scoped bus, bus per session, logger (MF-5, RT-10, RT-11, §9 Logging); one query client per area and new `quota.updated` / `bucket.updated` events (MF-2, RT-4, RT-12); `Task.seq` and `mergeTask`; tenant context in `Me` (SPEC-SHL-8); messages and formatting (MSG-1…4, SPEC-SHL-9); `Money` prices; remote-failure simulation via route interception and the gateway; tenant picker for provider/reseller (SPEC-CMP-4, SPEC-STO-3); error boundaries inside remotes and `ctx.path` (MF-6); traceability rules for TECH items and test-title prefixes; testable rewrites of the section-D ACs. New AC IDs (D-label → AC): D1.a → AC-SHL-1.9 · D1.b → AC-SHL-1.10 · D1.c → AC-SHL-1.11 · D12.a → AC-SHL-1.12 · D2.a–c → AC-SHL-7.1–7.3 · D3.a–e → AC-SHL-6.6–6.10 · D4.a–c → AC-SHL-6.11–6.13 · D5.e → AC-SHL-6.14 · D5.a → AC-TEN-3.5 · D5.c → AC-TEN-3.6 · D15 (AC-TEN-3.1 not-found) → AC-TEN-3.7 · D15 (AC-TEN-1.1 smoothness) → AC-TEN-1.8 · D5.b → AC-STO-1.4 · D5.d → AC-CMP-1.5 · D6.a → AC-TSK-1.4 · D6.b → AC-TSK-1.5 · D7.c → AC-TSK-1.6 · D6.c → AC-TEN-2.7 · D6.d → AC-TEN-4.5 · D7.a–b → AC-SHL-8.1–8.2 · D8.a–c → AC-SHL-9.1–9.3 · D11.a–c → AC-CMP-4.1–4.3 · D11.d → AC-STO-3.1 · D13.a–b → AC-SHL-4.5–4.6. Rewritten, IDs kept: AC-SHL-1.3, 1.4, 1.6, 1.8, 4.2, 4.3, 4.4, 5.1, 5.3, 6.2–6.5; AC-TEN-1.1, 2.1, 2.2, 2.4, 3.1, 3.2, 4.3; AC-CMP-1.1, 1.2, 1.4, 2.4; AC-TSK-1.1, 1.3; AC-STO-1.1, 1.2, 2.1–2.4; AC-SHL-2.2, 3.1, 3.2, 4.1 (message keys). TECH-7 split: TECH-12 (skills), TECH-13 (subagents).
> **v1.4 changes:** applies `docs/decisions/SPEC-REVIEW-v1.4-decisions.md` (E1–E15): gateway SPA fallback and build modes (§2.2, §12); RT-12 own-tenant events; mock-api test endpoints under `/api/__test/`; 9-day plan and TECH-14 shared libs (§14); `reportVitals` CSRF exemption (NFR-SEC-6); `TENANT_SUSPENDED`, `params.resource` and placeholder keys; NFR-PERF-5 replaces the perf AC; e2e browsers (§10); test levels for harness ACs; SPEC-CMP-5 VM detail and `canOpen`; `<RemoteBoundary>` for Vue (MF-6); `SessionSnapshot`; WebSocket limit of 5 per session; traceability bootstrap, ID registry, retired IDs (`specs/retired-ids.md`), stricter TECH verification; housekeeping. New AC IDs (E-label → AC): E1.a → AC-SHL-1.13 · E1.b → AC-SHL-1.14 · E2.a → AC-SHL-6.15 · E6.a → AC-TEN-2.8 · E9 AC-TEN-3.5 (a)/(b)/(c) → AC-TEN-3.8/3.9/3.10 · E10.a–c → AC-CMP-5.1–5.3 · E10.d → AC-TSK-1.7 · E12.a → AC-SHL-7.4 · E13.a–b → AC-STO-3.2–3.3. Retired: AC-TEN-1.8 (→ NFR-PERF-5), AC-SHL-1.11 (→ AC-SHL-1.6), AC-TEN-3.5 (→ AC-TEN-3.8/3.9/3.10). Rewritten, IDs kept: AC-SHL-1.4, 1.6, 1.9, 4.5, 6.4, 6.9, 9.3; AC-TEN-2.2, 3.2, 4.4; AC-STO-2.3. New TECH-14 (shared libs).
> **v1.5 changes:** owner decisions after the fourth review: message keys use `errors.*` and `connections.*` (O1); `canOpen(target, session)` with `tenant:read` for tenant links (§7 SPEC-TSK-1; O2, O3); required `NIMBUS_MODE` (`dev` · `e2e` · `demo`) for mock-api and the gateway, `NODE_ENV` never read (§2.2, §6.4, TEST-6; O4); drawer URL and history rules, `navigate(to, { replace })` (§2.4, §7 *Drawer URLs*; W1); RT-4 cache table completed (W2); §6.3 heading (W7). Then `docs/decisions/SPEC-REVIEW-v1.5-decisions.md` (F1–F9, F11–F14): admins on suspended tenants (SPEC-CMP-4, SPEC-STO-3, SPEC-TEN-3); e2e journeys E2E-9…16 (§10); `QUOTA_BELOW_USAGE` wording; CI job `ci/size`; VM ID mapping (mock-data §5); role in AC-TEN-3.10; `libs/format` function names (§9); Definition of Done (§16); per-day spec check (AGENTS.md §1a); `SessionSnapshot` type source (§2.4); F12–F13 already applied above; F14 history rule and ACs. New AC IDs (F-label → AC): F1.a → AC-CMP-4.4 · F1.b → AC-CMP-4.5 · F1.d → AC-CMP-4.6 (no spec named; placed in SPEC-CMP-4) · F14.d → AC-CMP-4.7 · F1.c → AC-TEN-3.11 · F14.a → AC-TEN-3.12 · F14.b → AC-TEN-3.13 · F14.c → AC-CMP-5.4. Rewritten, IDs kept: AC-TEN-3.2 (wording), AC-TEN-3.10 (role). Follow-ups (`docs/decisions/2026-10-31-v1.5-followups.md`): AC-TEN-3.10 role is reseller_admin; F1.d stays AC-CMP-4.6; `docs/agent-log.md` created, reviews in `docs/reviews/`; `NIMBUS_MODE=demo` is preview-only and the live demo uses `pnpm demo:local` (§15); suspended-tenant strings moved to the shared `tenantStatus.*` group. Day 1 check decisions (`docs/decisions/2026-10-31-day-1-decisions.md`): remote manifests (§2.2, NFR-SEC-1), spec split layout (§3.1), hook tests and `ci/hooks` (§11.4, §12), ADR timing (§13, §14), local `AGENTS.md` rules (§11.1).

---

## Table of contents

0. [How to use this spec](#0-how-to-use-this-spec)
1. [Product overview](#1-product-overview)
2. [Architecture & repository layout](#2-architecture--repository-layout)
3. [Traceability scheme](#3-traceability-scheme)
4. [Requirements (PRD level)](#4-requirements-prd-level)
5. [Roles & permissions (RBAC)](#5-roles--permissions-rbac)
6. [API contract](#6-api-contract)
7. [Feature specs](#7-feature-specs)
8. [Design system (ui-kit)](#8-design-system-ui-kit)
9. [Non-functional requirements](#9-non-functional-requirements)
10. [Testing strategy](#10-testing-strategy)
11. [Agent harness](#11-agent-harness)
12. [CI/CD pipeline](#12-cicd-pipeline)
13. [Architecture Decision Records](#13-architecture-decision-records)
14. [Build plan & milestones](#14-build-plan--milestones)
15. [Interview demo script](#15-interview-demo-script)
16. [Definition of Done](#16-definition-of-done)

---

## 0. How to use this spec

**Workflow for every feature (humans and agents):**

```
PRD requirement (REQ) → user story (US) → feature spec (SPEC + AC) → contract change (API) → code → tests → PR
```

1. Never write code for something that has no `SPEC-*` ID (features) or `TECH-*` ID (engineering work, `specs/tech-tasks.md`). If it's missing, write the spec first.
2. Any API change starts in `contracts/` (Section 6), then you regenerate clients. Never hand-edit `libs/api-client/src/generated/**`.
3. Every acceptance criterion (`AC-*`) with status `in-progress` or `done` has at least one test whose title starts with that ID (§3, T2/T3).
4. Every bug fix starts with a failing test named `BUG-<n>: …`.
5. Agents must read `AGENTS.md` and the relevant `SPEC-*` section before editing code.
6. Test titles start with a known ID (`tools/trace/ids.ts`, §3.2).

**Scope levels** used below: **[MVP]** must ship for the demo · **[Stretch]** build only if time allows.

---

## 1. Product overview

### 1.1 Problem
Cloud service providers resell infrastructure to their own customers (tenants). They need one portal where provider staff can manage tenants, compute and storage, and where tenant admins can self-serve within their limits. The UI must be dense, fast, safe and permission-aware.

### 1.2 Product
**Nimbus Console** is a mock admin and self-service portal on top of a fake cloud API. It has four areas:

| Area | Purpose | Implemented as |
|---|---|---|
| Shell | Login, navigation, layout, task center, error handling | React host app |
| Tenants | Manage tenants, quotas and plans | React remote |
| Storage (S3) | Buckets, usage, quotas | React remote |
| Compute | Virtual machines with realtime status and actions | **Vue 3** remote (mirrors V/IS) |

### 1.3 Personas

| Persona | Role ID | Goal |
|---|---|---|
| Provider administrator | `provider_admin` | Manage all tenants and infrastructure |
| Reseller administrator | `reseller_admin` | Manage tenants they own |
| Tenant administrator | `tenant_admin` | Self-serve VMs and buckets within quota |
| Tenant viewer | `tenant_viewer` | Read-only view of their tenant |

### 1.4 Goals
- G1: Show a complete spec → contract → code → test trace for every feature.
- G2: Show micro-frontends in two frameworks (React + Vue) under one shell.
- G3: Show agent harness that catches agent mistakes automatically.
- G4: Show production-grade quality gates running on every PR.

### 1.5 Non-goals
- Real authentication (OIDC), real infrastructure, real billing.
- Mobile layouts below 1024 px (admin tool; desktop first).
- Internationalisation beyond English (strings are still externalised, see `NFR-I18N-1`).

---

## 2. Architecture & repository layout

### 2.1 Stack

Exact versions are pinned in ADR-0001. Dev ports: shell 4200 · tenants 4201 · storage 4202 · compute 4203 · mock-api 4000 · gateway 8080 (ADR-0005).


| Concern | Choice |
|---|---|
| Monorepo | Nx + pnpm workspaces |
| Build / dev server | Vite |
| Micro-frontends | Module Federation via `@module-federation/vite` on Vite 8 (**ADR-0001** — not Nx's Webpack/Rspack MF generators) |
| Host + 2 remotes | React 19 · TypeScript 6.0 (strict) |
| 1 remote | Vue 3.5 (Composition API, `<script setup>`) · TypeScript 6.0 (strict) |
| Server state | TanStack Query (React and Vue adapters), one `QueryClient` per area (MF-2) |
| Client state | Zustand (React), Pinia (Vue) — only for UI state |
| Routing | React Router (shell + React remotes), Vue Router (compute remote, memory-history inside host) |
| Tables | TanStack Table + TanStack Virtual |
| Forms & validation | React Hook Form + Zod (generated schemas) |
| Contract | TypeSpec 1.17 → OpenAPI 3.1 (`contracts/main.tsp`, compiled to `contracts/openapi.yaml`) |
| Client generation | Orval → typed fetch client, TanStack Query hooks, Zod schemas, MSW handlers |
| Mock backend | Fastify + `@fastify/websocket`, in-memory seeded data |
| Gateway | Fastify + `@fastify/static` + `@fastify/http-proxy` (`apps/gateway`): one origin for app, remotes and API (ADR-0005) |
| Unit/component tests | Vitest + Testing Library |
| Component workshop | Storybook (React + Vue) with interaction tests (`play` functions) |
| E2E | Playwright |
| Lint/format | ESLint (flat config) + custom rules, Prettier |
| Bundle budgets | `size-limit` per remote |
| RUM | `web-vitals` library → `/api/rum` endpoint |
| CI | GitHub Actions |

### 2.2 Runtime diagram

```
┌──────────────────────────── Browser ─────────────────────────────┐
│  apps/shell (React host)                                         │
│   ├─ auth/session, nav, layout, task center, error panels        │
│   ├─ loads remote: tenants  (React)  ── /tenants/*               │
│   ├─ loads remote: storage  (React)  ── /storage/*               │
│   └─ loads remote: compute  (Vue 3)  ── /compute/*  via mount()  │
└───────────────┬───────────────────────────────┬──────────────────┘
                │ REST /api/* (generated client)│ WebSocket /api/events
                ▼                               ▼
          apps/gateway :8080 — serves /, /remotes/<name>/, proxies /api/*
                │
                ▼
          apps/mock-api :4000 (Fastify, in-memory DB, task runner)
```

In development the shell's Vite dev server (4200) proxies `/api` (with `ws: true`) to mock-api, and remotes load from their own dev servers (4201–4203). That cross-origin traffic is static code only, without credentials. CI e2e, preview and demo always run against the gateway (ADR-0005).

**Remote manifests.** The shell always fetches `/remotes.json` and validates it with Zod; a bad manifest shows an error, never a blank page. Because the gateway is same-origin, there are only two manifests:

| Manifest | URLs | Served by |
|---|---|---|
| `config/remotes.dev.json` | `http://localhost:4201/remoteEntry.js` etc. | the shell's Vite dev server, at `/remotes.json` |
| `config/remotes.gateway.json` | `/remotes/tenants/remoteEntry.js` etc. | the gateway, at `/remotes.json`, for e2e, `demo:local` and the preview deploy |

The CSP `script-src` is generated from the same file (NFR-SEC-1), so the two can't drift apart.

**Gateway resolution order** (in dev, Vite's dev server already falls back to `index.html`):
1. `/api/*` → proxy to mock-api (including the WebSocket upgrade).
2. `/remotes.json` → `config/remotes.gateway.json`.
3. `/remotes/<name>/*` → that remote's static files. A missing file returns **404 and never falls back**, so a broken remote fails loudly (MF-4).
4. A real file in the shell's build → serve it.
5. Any other `GET` or `HEAD` whose `Accept` includes `text/html` → the shell's `index.html` with **200**.
6. Anything else → 404.

**Build modes:**

| Mode | Used by | `VITE_TEST_HOOKS` | Test routes (`/__crash`) | Server `NIMBUS_MODE` |
|---|---|---|---|---|
| `development` | `pnpm dev` | true | yes | `dev` |
| `e2e` | CI e2e, perf, local `pnpm e2e` | true | yes | `e2e` |
| `production` | deploys, size budgets | false | **no** | `demo` |

`e2e` is a production-optimised build (minified, same chunking) plus the test hooks. `ci/no-test-hooks` builds `production` and fails if `__crash` or `/__test/` appears in any bundle. mock-api and the gateway read one required variable, **`NIMBUS_MODE`** (`dev` · `e2e` · `demo`), which sets their defaults (`specs/mock-data.md` §8). Test endpoints exist only when `NIMBUS_MODE` is `dev` or `e2e`. A missing or invalid value stops the server at start-up. `NODE_ENV` is never read by our own code (libraries change behaviour on it, and our builds set it to `production` even in e2e).

### 2.3 Repository layout

```
nimbus-console/
├─ AGENTS.md                      # agent entry point (Section 11)
├─ SPEC.md                        # this file
├─ contracts/
│  ├─ main.tsp                    # TypeSpec source of truth
│  └─ openapi.yaml                # compiled, committed, CI-checked
├─ specs/
│  ├─ requirements.md             # REQ-*
│  ├─ stories/US-*.md
│  ├─ features/SPEC-<AREA>-<n>-<slug>.md  # one file per feature spec (split from Section 7, §3.1)
│  ├─ shared/<topic>.md           # shared blocks and rule IDs (url-conventions, rbac, realtime, messages-and-format, mf-contract)
│  ├─ tech-tasks.md               # TECH-* items and their statuses
│  ├─ retired-ids.md              # withdrawn IDs and their replacements (never reused)
│  └─ mock-data.md
├─ docs/adr/ADR-000x-*.md
├─ docs/decisions/                # dated decision records
├─ docs/reviews/                  # dated spec-review outputs
├─ docs/agent-log.md              # one entry per agent incident
├─ config/remotes.dev.json, config/remotes.gateway.json   # remote manifests (§2.2)
├─ apps/
│  ├─ shell/                      # React host
│  ├─ tenants/                    # React remote
│  ├─ storage/                    # React remote
│  ├─ compute/                    # Vue remote
│  ├─ mock-api/                   # Fastify + ws
│  ├─ gateway/                    # same-origin gateway (ADR-0005)
│  └─ e2e/                        # Playwright
├─ libs/
│  ├─ api-client/                 # generated (React + Vue query hooks, zod, msw)
│  ├─ auth/                       # session + permission helpers, canOpen() (framework-agnostic core)
│  ├─ ui-kit/                     # React design system + tokens
│  ├─ ui-kit-vue/                 # Vue wrappers using the same tokens
│  ├─ design-tokens/              # CSS variables (single source)
│  ├─ mf-contract/                # remote mount/unmount types + root/scoped EventBus (§2.4, §2.5)
│  ├─ realtime/                   # the only WebSocket client; validates and publishes to the bus; mergeTask (§2.5)
│  ├─ logger/                     # framework-agnostic logger (§9 Logging)
│  ├─ messages/                   # shared typed message catalogue (§9 Messages & formatting)
│  ├─ format/                     # bytes, percent, dates, counts, money (§9 Messages & formatting)
│  └─ test-utils/                 # mountRemote(module, ctx), createFakeBus()
├─ tools/
│  ├─ eslint-rules/               # custom lint rules from review loop
│  ├─ trace/                      # trace:check, ids.ts (known ID prefixes)
│  ├─ mcp-spec-server/            # MCP server over specs + contract
│  └─ evals/                      # skill evals
├─ .claude/                       # agent settings, hooks, skills, subagents
└─ .github/workflows/ci.yml
```

### 2.4 Micro-frontend contract (`libs/mf-contract`)

Every remote exposes the same framework-agnostic interface so React and Vue remotes are interchangeable for the shell:

```ts
export interface RemoteContext {
  basePath: string;                 // e.g. "/compute"
  path: string;                     // current path below basePath, with search and hash, e.g. "/t_acme?tab=quotas"
  session: SessionSnapshot;         // user, tenant (TenantSummary | null), permissions[]
  navigate: (to: string, options?: { replace?: boolean }) => void; // shell owns the URL; replace = no new history entry
  events: ScopedBus;                // this remote's scope of the root bus (§2.5)
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

Permission checks use `can(snapshot, permission)` from `libs/auth`.

`Role`, `Permission` and `TenantSummary` come from the generated contract models, so the snapshot changes when the contract changes. `libs/api-client` exposes them through a dedicated entry point, `@nimbus/api-client/model` (`package.json` `exports` → `src/generated/model/index.ts`), which contains types and enum constants only. `libs/mf-contract` imports them with `import type` only, so it has no runtime dependency on the API client; this is enforced by `@typescript-eslint/consistent-type-imports` and a dependency rule in `libs/mf-contract/eslint.config.mjs` that forbids value imports from `@nimbus/api-client`. Nx project graph: `mf-contract` → `api-client` (type-only).

`update(ctx)` must be implemented. Each remote keeps the context reactive (a ref provided via `provide`/`inject` in Vue, a context provider or store in React), and components read session, permissions and path from it. The shell calls `update` when the path under the remote's `basePath` changes, and on session changes only when `user.id`, `tenant` or `permissions` change (shallow comparison; SPEC-SHL-7).

Rules:
- **MF-1** The shell owns the browser URL. Remotes use memory routing, sync it to `ctx.path` on `mount` and `update`, and change it only through `ctx.navigate` (with `{ replace: true }` when the change must not add a history entry, see §7 *Drawer URLs*).
- **MF-2** Shared singletons: `react`, `react-dom`, `@tanstack/react-query`, `@nimbus/design-tokens`. Vue is shared only within the compute remote. The query **library** is shared; cache **instances** are not: every area (shell, tenants, storage, compute) creates its own `QueryClient`.
- **MF-3** Remotes never import from each other. Cross-remote communication only goes through `EventBus` with typed events.
- **MF-4** A remote that fails to load or throws shows a contained error panel with *Retry*; the rest of the shell keeps working.
- **MF-5** After `remote.unmount()`, the shell calls `dispose()` on that remote's bus scope, removing every subscription it still holds.
- **MF-6** Error boundaries live inside each remote, because a React remote renders into its own React root that the shell's boundary can't see. On `fatal: true` the shell unmounts the remote, disposes its scope and shows the MF-4 panel; `fatal: false` errors are only logged. The shell's own boundary covers load failures and a `mount()` that throws.
  - **React remotes** wrap their root in an `ErrorBoundary`. Render errors are published as `remote:error { fatal: true }`. Errors the boundary doesn't catch (event handlers, async work) are published with `fatal: false`.
  - **The Vue remote**'s root component is `<RemoteBoundary>`. It uses `onErrorCaptured` to catch **every** error raised inside Vue components (setup, render, lifecycle hooks, watchers, component event handlers), renders nothing further, publishes `remote:error { fatal: true }` and returns `false`. It never parses Vue's `info` string (a short code in production builds). Errors outside components (`window` `error` / `unhandledrejection` from compute code) are published with `fatal: false`.
  - **Accepted difference:** event-handler errors are non-fatal in React remotes and fatal in Vue. Both produce exactly one logger entry, and the user is never left with a silently broken view.

### 2.5 Realtime and the EventBus

The browser tab has **one** WebSocket, owned by the shell. Remotes never see the socket; they only see the `ScopedBus` they receive in `RemoteContext`.

```
mock-api ──WS /api/events──▶ libs/realtime (inside shell)
                               │ 1. validate with generated Zod ServerEvent schema
                               │ 2. reconnect / backoff (WS-1), close codes (WS-5), status (WS-7)
                               ▼
                            root EventBus  ──scope('tenants' | 'storage' | 'compute')──▶ remotes
             ┌─────────────┬───────────────┼──────────────────┐
             ▼             ▼               ▼                  ▼
        shell           tenants (React)  storage (React)   compute (Vue)
   task center         tenants, quotas   buckets, quotas   VMs, VM tasks
```

**Why the shell owns it:** one connection per tab instead of three, and one place for auth (session cookie, NFR-SEC-3) and reconnect logic. Remotes stay simple: a remote only knows the bus, so it doesn't care whether events come from a WebSocket, a test or Storybook.

#### Rules

| ID | Rule |
|---|---|
| RT-1 | Only `libs/realtime` may open a WebSocket. Remotes never do (lint: `nimbus/no-websocket-outside-realtime`). One socket per tab. |
| RT-2 | Every message is validated with the generated Zod `ServerEvent` schema. Invalid messages are dropped and logged (`realtime.invalid_message`), never forwarded. |
| RT-3 | Valid messages are published on the bus as `server:<type>` (e.g. `server:vm.updated`). `heartbeat` is not forwarded. |
| RT-4 | Ownership is the cache instance (MF-2). Any area may call any operation it has permission for and cache the result in **its own** client; no area touches another area's cache. Query keys always come from Orval's generated helpers (lint: `nimbus/no-handwritten-query-key`). Each area applies server events to its own cache as in the table below. |
| RT-5 | Consumers batch updates per animation frame before writing to the cache (WS-3). |
| RT-6 | On `realtime:reconnected`, each area invalidates only its own active queries, because events may have been missed (WS-2). |
| RT-7 | A remote removes every subscription, and cancels any pending frame, on `unmount()`. A test proves it. MF-5 removes anything it forgot. |
| RT-8 | An error thrown in one subscriber is caught and logged with the subscriber's scope. It never stops delivery to other subscribers. |
| RT-9 | `realtime:status` is sticky: a new subscriber immediately (synchronously) receives the latest value. That way a remote mounted later still shows the right connection state. |
| RT-10 | The root bus lives for **one session**. On sign-out or expiry, the shell unmounts remotes, disposes all scopes, closes the WebSocket and creates a **new** root bus, so sticky status and all subscriptions start fresh. |
| RT-11 | `realtime:reconnected` is published only after a connection that **follows** a lost one, never on the first connection of a session. |
| RT-12 | A session receives events about resources it can read, **plus** `tenant.updated` and `quota.updated` for its own tenant (`me.tenant.id`), even without `tenant:read`. Resellers receive events for their own tenants and providers for all. |

**What each area caches and which events it applies (RT-4):**

| Area | Caches | Applies |
|---|---|---|
| shell | `getMe`, `listTasks` (task center) | `server:task.updated` (via `mergeTask`); `server:tenant.updated` for the user's own tenant → patch `me.tenant.status` (SPEC-SHL-8) |
| tenants | `listTenants`, `getTenant`, `getQuotas`, `listTasks?resourceId=` (drawer Activity), `listPlans` | `server:tenant.updated`, `server:quota.updated`, `server:task.updated` for `resource.type = tenant` |
| storage | `listBuckets`, `getQuotas` (usage card), `listTenants` (admin tenant picker, SPEC-STO-3) | `server:quota.updated`, `server:bucket.updated` |
| compute | `listVms`, `getVm`, `getTask` for a VM's `activeTaskId` on mount, `listTasks?resourceId=` (VM drawer, SPEC-CMP-5), `listTenants` / `getTenant` (admin tenant picker and context line, SPEC-CMP-4) | `server:vm.updated` (batched per frame), `server:task.updated` for `resource.type = vm` |

#### EventBus API (`libs/mf-contract/src/event-bus.ts`)

```ts
import type { Task, Vm, Tenant, TenantQuotas, Bucket } from '@nimbus/api-client/model'; // type-only

export interface BusEvents {
  // ── Shell → remotes: server events (RT-3) ──
  'server:task.updated':   { task: Task };
  'server:vm.updated':     { vm: Pick<Vm, 'id' | 'status' | 'ip' | 'activeTaskId'> };
  'server:tenant.updated': { tenant: Pick<Tenant, 'id' | 'status'> };
  'server:quota.updated':  { tenantId: string; quotas: TenantQuotas };
  'server:bucket.updated': { tenantId: string; bucket: Bucket | null; name: string }; // bucket null = deleted

  // ── Shell → remotes: connection lifecycle ──
  'realtime:status':      { state: 'connecting' | 'connected' | 'reconnecting' | 'offline'; attempt: number }; // sticky (RT-9)
  'realtime:reconnected': { downtimeMs: number };                                                             // RT-11

  // ── Remotes → shell ──
  'task:started':    { task: Task };                 // every task-producing 2xx response (SPEC-TSK-1)
  'toast:show':      { kind: 'success' | 'error' | 'info'; message: string; resource?: { type: string; id: string } };
  'session:expired': { source: string };             // remote got a 401 → shell redirects to /login?reason=expired
  'remote:error':    { remote: string; message: string; stack?: string; fatal: boolean }; // MF-6
}

export type BusEventName = keyof BusEvents;
export type RemotePublishable = 'task:started' | 'toast:show' | 'session:expired' | 'remote:error';

export interface ScopedBus {
  publish<K extends RemotePublishable>(type: K, payload: BusEvents[K]): void;
  subscribe<K extends BusEventName>(
    type: K,
    handler: (payload: BusEvents[K], meta: { source: string; ts: number }) => void,
  ): () => void; // returns unsubscribe
}

export interface RootBus {
  publish<K extends BusEventName>(type: K, payload: BusEvents[K]): void;
  subscribe: ScopedBus['subscribe'];
  scope(source: string): ScopedBus & { dispose(): void };
  subscriberCount(source: string): number; // for tests
}

export declare function createRootBus(): RootBus;
```

- The shell owns the root bus and passes each remote `rootBus.scope('<remote>')`.
- Remotes may only publish `RemotePublishable`. This is enforced by types, and at runtime: a disallowed publish throws in dev/test and is dropped and logged in production.
- Every delivery carries `meta.source`; subscriber errors are logged with the subscriber's scope (RT-8).

Notes on the catalogue:
- **Payloads come from the generated contract types.** If the contract changes `Vm`, the bus types change too, and TypeScript errors show every place that needs updating.
- **Toasts go through the shell**, so there's one `aria-live` region for the whole page. That's better for screen readers than one toast system per remote.
- **Delivery is synchronous and in-memory.** There's no replay except for the sticky `realtime:status`. A remote that mounts later loads fresh data through its queries anyway.
- **Changing the catalogue:** adding an event is safe. Changing a payload's shape means a new event name or an ADR, the same rule as breaking API changes (API-6).

#### Task merging (`libs/realtime`)

Every task has a `seq` that increases with every change (`0` in the 201/202 response). Every place that caches tasks upserts through one function:

```ts
export function mergeTask(current: Task | undefined, incoming: Task): Task {
  if (!current) return incoming;
  if (isTerminal(current.status)) return current;           // succeeded/failed never revert
  return incoming.seq > current.seq ? incoming : current;   // stale or duplicate → ignored
}
```

A late `task:started` (`seq: 0`) can never overwrite newer progress, in any arrival order. Every task-producing response publishes `task:started` from the area that called it:

| Operation | Response | Publisher |
|---|---|---|
| `createTenant` | `201 TenantCreated { tenant, task }` | tenants (wizard) |
| `suspendTenant`, `resumeTenant` | `202 Task` | tenants |
| `runVmAction` | `202 Task` | compute |

#### How it reaches the Vue remote

Mounting: the compute remote receives its scoped bus in `ctx`, provides it and a reactive context to all its components, and implements `update` (§2.4).

```ts
// apps/compute/src/mount.ts
import { createApp, shallowRef } from 'vue';
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';
import type { RemoteModule, RemoteContext } from '@nimbus/mf-contract';
import { configureApiClient } from '@nimbus/api-client';
import RemoteBoundary from './RemoteBoundary.vue';   // root: onErrorCaptured → remote:error { fatal: true } (MF-6)
import { BUS_KEY, CTX_KEY } from './realtime/bus';

export const mount: RemoteModule['mount'] = (el, initial) => {
  const ctx = shallowRef<RemoteContext>(initial);  // components read session, permissions and path from it
  const queryClient = new QueryClient();           // own cache instance (MF-2)
  configureApiClient({ onUnauthorized: () => ctx.value.events.publish('session:expired', { source: 'compute' }) });
  const app = createApp(RemoteBoundary);            // wraps App; never parses Vue's `info` string
  app.provide(BUS_KEY, initial.events);
  app.provide(CTX_KEY, ctx);
  app.use(VueQueryPlugin, { queryClient });
  // Errors outside components (window `error` / `unhandledrejection` from compute code) → remote:error { fatal: false }
  app.mount(el);
  return {
    unmount: () => app.unmount(),
    update: (next) => { ctx.value = next; },       // memory router syncs to next.path (MF-1)
  };
};
```

A composable that subscribes and cleans up automatically (RT-7):

```ts
// apps/compute/src/realtime/useBusEvent.ts
import { inject, onUnmounted } from 'vue';
import type { BusEventName, BusEvents, ScopedBus } from '@nimbus/mf-contract';
import { BUS_KEY } from './bus';

export function useBusEvent<K extends BusEventName>(type: K, handler: (p: BusEvents[K]) => void) {
  const bus = inject(BUS_KEY) as ScopedBus;
  const off = bus.subscribe(type, handler);
  onUnmounted(off);
}
```

Writing VM updates into the cache, batched per frame (RT-4, RT-5, RT-6, RT-7):

```ts
// apps/compute/src/realtime/useVmRealtime.ts
import { onUnmounted } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { useBusEvent } from './useBusEvent';
import { applyVmPatches, type VmPatch } from './vmPatches';

export function useVmRealtime() {
  const qc = useQueryClient();
  const pending = new Map<string, VmPatch>();   // last update per VM wins
  let frame = 0;

  const flush = () => {
    frame = 0;
    qc.setQueriesData({ queryKey: ['vms'] }, (page) => applyVmPatches(page, pending));
    pending.clear();
  };

  useBusEvent('server:vm.updated', ({ vm }) => {
    pending.set(vm.id, vm);
    if (!frame) frame = requestAnimationFrame(flush);   // 50 events in one frame → one cache write (AC-CMP-1.2)
  });

  useBusEvent('realtime:reconnected', () => qc.invalidateQueries({ queryKey: ['vms'] })); // AC-CMP-1.3

  onUnmounted(() => cancelAnimationFrame(frame));       // RT-7: no write after unmount
}
```

(`['vms']` stands for the key prefix from Orval's generated helper; RT-4 forbids hand-written keys in real code.)

#### End to end: the user clicks *Reboot* in the Vue remote

1. Compute calls `runVmAction`, gets `202 { task }` (`seq: 0`), sets the row to `rebooting` optimistically and publishes `task:started`. The shell's task center shows it immediately (AC-TSK-1.1).
2. The mock API sends `task.updated` events with progress and increasing `seq`. The shell validates each one and publishes `server:task.updated`. The task center merges it into its own cache with `mergeTask`; compute merges `resource.type = vm` tasks into its own Vue cache the same way and shows the row's progress % (RT-4).
3. When the task finishes, the server sends `vm.updated` with status `running`. The shell publishes `server:vm.updated`, compute batches it into the next frame, and the row updates with no HTTP request (AC-CMP-1.1).
4. If the task failed, compute publishes `toast:show` with the mapped message for the task's `error.code` (MSG-3), and the shell shows it.

---

## 3. Traceability scheme

| Prefix | Level | Example | Lives in |
|---|---|---|---|
| `REQ-<n>` | Product requirement | `REQ-4` | `specs/requirements.md` |
| `US-<n>.<m>` | User story | `US-4.2` | `specs/stories/` |
| `SPEC-<AREA>-<n>` | Feature spec | `SPEC-TEN-2` | `specs/features/` |
| `AC-<AREA>-<n>.<m>` | Acceptance criterion | `AC-TEN-2.3` | inside feature spec |
| `NFR-<TOPIC>-<n>` | Non-functional requirement | `NFR-PERF-2` | Section 9 |
| `TECH-<n>` | Engineering task (workspace, tooling, infra, harness) | `TECH-2` | `specs/tech-tasks.md` |
| `ADR-<nnnn>` | Architecture decision | `ADR-0002` | `docs/adr/` |
| `BUG-<n>` | Bug | `BUG-7` | GitHub issue |

Areas: `SHL` shell · `TEN` tenants · `STO` storage · `CMP` compute · `TSK` tasks · `RBAC` permissions.

### 3.1 AC status

Every AC has exactly one status, written right after its ID. Until the split (under TECH-1), ACs live in §7. After it, ACs and their statuses live **only** in `specs/features/SPEC-*.md`, §7 becomes an index with links, and `trace:check` parses `specs/features/` and `specs/shared/` and fails if an ID is defined in more than one file. The split is the **first commit of TECH-1**:
- **Feature specs:** one file each, flat, named `specs/features/SPEC-<AREA>-<n>-<slug>.md` (e.g. `SPEC-TEN-2-create-tenant-wizard.md`). Front matter: `id`, `title`, `area`, `day`, `implements` (US IDs). Then the sections, and an **AC table with a Status column** (`| ID | Criterion | Status |`).
- **Shared blocks:** `specs/shared/<topic>.md`, one file per topic: `url-conventions.md` (drawer URLs, `tenantId`, history rules), `rbac.md` (matrix, RBAC-1…6), `realtime.md` (RT and WS rules, bus catalogue), `messages-and-format.md` (MSG-1…4, the `libs/format` functions), `mf-contract.md` (MF rules, `RemoteContext`, `SessionSnapshot`). Feature specs link to shared files and never copy from them. Rule IDs live only in shared files.
- **SPEC.md keeps** the overview, architecture summary, NFRs, testing strategy, build plan, demo script, Definition of Done, and an index linking every feature and shared file.

Until the split exists, until `specs/features/` exists, `trace:check` runs only T1 and prints a warning. Example lines use the placeholder `AC-XXX-n.m` inside code blocks, and the parser ignores code blocks:

```md
- **AC-XXX-n.m** `planned` Given …, when …, then …
```

| Status | Meaning | Set by |
|---|---|---|
| `planned` | Specified, not started | spec author |
| `in-progress` | A PR is building it; tests may be partial | the PR that starts the work |
| `done` | Implemented and covered by ≥ 1 passing test | the PR that finishes it |

A PR that implements an AC changes its status in the same PR. Status only moves forward, unless a PR deliberately reopens an AC and says why in its description.

`TECH-*` items follow the same statuses, kept in `specs/tech-tasks.md`. The PR that works on a TECH item sets `in-progress` or `done` there. A `done` TECH item needs **at least one passing test whose title starts with its ID**. A `verify:` line may additionally name a **TECH-specific** CI job (e.g. `ci/contract-check`, `ci/no-test-hooks`), never `ci/affected`; `trace:check` confirms the job exists in the workflow file.

Withdrawn IDs are **retired**, never reused, and listed with their replacements in `specs/retired-ids.md`.

### 3.2 Conventions
- Test titles start with a known ID: `it('AC-TEN-2.3: blocks Next when quota exceeds plan limit', …)`. Allowed prefixes are listed once, in `tools/trace/ids.ts`, and used by both `trace:check` (T4) and the lint rule `nimbus/test-name-has-id`: `AC TECH BUG NFR MF RT WS RBAC API TEST MSG HOOK E2E ADR`. `trace:check` builds the list of **existing IDs** by scanning `specs/features/*.md`, `specs/tech-tasks.md` and SPEC.md for bold IDs at the start of a list item or table cell (e.g. `**RT-12**`), `specs/shared/*.md`, `docs/adr/` filenames, and GitHub issues for `BUG-`.
- Commit messages: `feat(tenants): create wizard [SPEC-TEN-2]`, `chore(ci): add size-limit [TECH-11]`.
- PR template has a required **Implements:** field listing IDs (`tools/check-trace.ts`). Infra PRs use `TECH-*` IDs, or existing `NFR-*` / `ADR-*` IDs. No PR is exempt.
- `pnpm trace` prints a matrix: each AC → status → tests that cover it → pass/fail.

### 3.3 Trace rules (`trace:check`, CI step 3)

| # | Rule | Why |
|---|---|---|
| T1 | The PR's **Implements:** field must list at least one known ID (`AC-*`, `SPEC-*`, `TECH-*`, `NFR-*`, `ADR-*`, `BUG-*`). | Every PR is traceable |
| T2 | Every `AC-*` or `TECH-*` listed in the PR must have at least one passing test titled with its ID by the end of the PR, and its status must be `done` or `in-progress`. | You can't claim an AC without proving it |
| T3 | Every AC or TECH item with status `done` anywhere in the specs must still have at least one passing test titled with its ID. | Stops a later PR from deleting or renaming the test behind a finished feature |
| T4 | A test title that references an unknown or **retired** ID fails the check. | Catches typos like `AC-TEN-2.9` and reuse of withdrawn IDs |
| T5 | `planned` ACs are reported but never fail CI. | Unbuilt features don't block anything |
| T6 | `BUG-*` PRs must add a test titled with that bug's ID. | Every bug fix comes with a test (TEST-2) |

`trace:check` also **warns** (never fails) while any message in `specs/mock-data.md` §10 is marked `draft` (MSG-4).

---

## 4. Requirements (PRD level)

| ID | Requirement | Priority |
|---|---|---|
| REQ-1 | Users sign in and see only the areas and actions their role allows. | MVP |
| REQ-2 | Provider and reseller admins can browse, search, sort and filter large tenant lists (10,000+ rows) without lag. | MVP |
| REQ-3 | Provider and reseller admins can create a tenant with a plan and quotas in a guided flow. | MVP |
| REQ-4 | Admins can suspend and resume a tenant, with safeguards against mistakes. | MVP |
| REQ-5 | Tenant admins can see their VMs and their live status without refreshing. | MVP |
| REQ-6 | Tenant admins can start, stop and reboot VMs; long operations show progress and outcome. | MVP |
| REQ-7 | Users can see all their running and recent operations in one place. | MVP |
| REQ-8 | Tenant admins can manage S3 buckets and see usage against quota. | MVP |
| REQ-9 | Admins can set storage quotas for a tenant. | MVP |
| REQ-10 | The portal stays usable if one area fails to load. | MVP |
| REQ-11 | The team can measure real-user performance. | MVP |
| REQ-12 | Admins can view pricing plans. | Stretch |
| REQ-13 | Users can create a VM with a multi-step wizard. | Stretch |

### User stories

| ID | Story | Req |
|---|---|---|
| US-1.1 | As any user, I sign in and land on the first area I'm allowed to see. | REQ-1 |
| US-1.2 | As a tenant viewer, I don't see buttons for actions I can't perform. | REQ-1 |
| US-2.1 | As a provider admin, I search tenants by name and filter by status and plan. | REQ-2 |
| US-2.2 | As a provider admin, I sort tenants by name, created date and usage. | REQ-2 |
| US-2.3 | As a reseller admin, I see only tenants that belong to me. | REQ-2 |
| US-3.1 | As a provider admin, I create a tenant in steps: details → plan & quotas → review. | REQ-3 |
| US-4.1 | As a provider admin, I suspend a tenant only after confirming by typing its name. | REQ-4 |
| US-5.1 | As a tenant admin, I see VM status change in real time. | REQ-5 |
| US-6.1 | As a tenant admin, I start/stop/reboot a VM and see a progress indicator until it finishes. | REQ-6 |
| US-7.1 | As any user, I open a task center showing running and recent tasks with status. | REQ-7 |
| US-8.1 | As a tenant admin, I create a bucket with a valid name and see it in the list. | REQ-8 |
| US-8.2 | As a tenant admin, I see storage used vs quota. | REQ-8 |
| US-9.1 | As a provider admin, I change a tenant's storage quota. | REQ-9 |
| US-10.1 | As any user, if the Storage area is down, Tenants and Compute still work. | REQ-10 |
| US-11.1 | As an engineer, I see LCP, INP and CLS reported from real sessions. | REQ-11 |

---

## 5. Roles & permissions (RBAC)

### 5.1 Permission strings
Permissions are strings returned by `GET /me`. The UI **never** checks role names, only permissions (`RBAC-1`).

```
tenant:read  tenant:create  tenant:update  tenant:suspend
quota:read   quota:update
vm:read      vm:operate     vm:create
bucket:read  bucket:create  bucket:delete
task:read
plan:read
```

### 5.2 Matrix

| Permission | provider_admin | reseller_admin | tenant_admin | tenant_viewer |
|---|:-:|:-:|:-:|:-:|
| tenant:read | ✅ all | ✅ own | — | — |
| tenant:create | ✅ | ✅ | — | — |
| tenant:update | ✅ | ✅ own | — | — |
| tenant:suspend | ✅ | — | — | — |
| quota:read | ✅ | ✅ | ✅ | ✅ |
| quota:update | ✅ | ✅ own | — | — |
| vm:read | ✅ | ✅ | ✅ | ✅ |
| vm:operate | ✅ | — | ✅ | — |
| vm:create | — | — | ✅ | — |
| bucket:read | ✅ | ✅ | ✅ | ✅ |
| bucket:create / delete | — | — | ✅ | — |
| task:read | ✅ | ✅ | ✅ | ✅ |
| plan:read | ✅ | ✅ | — | — |

Scope (all / own) is enforced by the **API**. The UI only hides or disables; it is never the security boundary (`RBAC-2`).

The Tenants area (`/tenants`) is the provider/reseller management area, so tenant roles don't get `tenant:read`. They reach their own tenant's data through `vm:read`, `bucket:read` and `quota:read`, scoped by the server to `me.tenant.id`, and see a read-only summary of their tenant in `Me.tenant` (SPEC-SHL-8). Their home area is **`/compute`** (SPEC-SHL-1).

### 5.3 UI rules
- **RBAC-1** Use `can('tenant:suspend')` / `<Can permission="…">` / `v-can="'…'"` — never compare role names.
- **RBAC-2** The UI is not a security boundary. Every mutating API call can still return `403`; handle it (`AC-SHL-3.2`).
- **RBAC-3** Navigation items are hidden when the user lacks the area's `*:read` permission.
- **RBAC-4** Actions the user can't perform are **hidden** in toolbars; in contexts where the user should know the action exists (e.g. row menu), they're **disabled with a tooltip** `rbac.disabledTooltip` "You don't have permission to {action}.", with `{action}` from the `actions.*` keys (`specs/mock-data.md` §10).
- **RBAC-5** Directly visiting a URL without permission shows a *403 – No access* page, not a blank screen.
- **RBAC-6** Permission string constants come from the generated contract enum `Permission`; hard-coded strings are a lint error (`nimbus/no-raw-permission`).

---

## 6. API contract

### 6.1 Principles
- **API-1** Contract-first: change `contracts/main.tsp` → `pnpm contract:build` → `pnpm api:generate`. CI fails if `openapi.yaml` or generated code is out of date.
- **API-2** All errors use RFC 9457 `application/problem+json`: `{ type, title, status, detail, code, params?, errors? }`. The UI shows only the message for `code`, filled from `params` (MSG-3).
- **API-3** Lists use cursor pagination: `?limit=50&cursor=…` → `{ items, nextCursor, total }`.
- **API-4** Long operations return `202 Accepted` with a `Task`; progress arrives over WebSocket and via `GET /tasks/{id}`.
- **API-5** All responses are validated at runtime with generated Zod schemas in dev and test; in production validation failures are logged, not thrown.
- **API-6** Breaking contract changes require an ADR.

### 6.2 Resources

The complete contract is **`contracts/main.tsp`** (source of truth) and the compiled **`contracts/openapi.yaml`**. This table is an index only; if it ever disagrees with the contract, the contract wins. Each operation carries its required permission as `x-permission`. All paths are under **`/api`** (gateway and dev proxy, ADR-0005). Every POST/PUT/PATCH/DELETE to an authenticated endpoint requires `X-Nimbus-Csrf: 1` and a same-origin `Origin`, else 403. The only exemption is `reportVitals` (NFR-SEC-6).

| operationId | Method & path | Permission | Notable errors |
|---|---|---|---|
| login | POST /login → `Me`, sets session cookie | — (demo) | 403 · 422 |
| logout | POST /logout → 204, clears cookie | — | 401 · 403 |
| getMe | GET /me | — | 401 |
| listPlans | GET /plans | plan:read | |
| listTenants | GET /tenants?q&status&planId&sort&limit&cursor | tenant:read | 422 |
| createTenant | POST /tenants → 201 `TenantCreated { tenant, task }` | tenant:create | 409 TENANT_NAME_TAKEN · 422 QUOTA_EXCEEDS_PLAN |
| getTenant | GET /tenants/{tenantId} | tenant:read | 404 |
| updateTenant | PATCH /tenants/{tenantId} | tenant:update | 422 QUOTA_EXCEEDS_PLAN |
| suspendTenant | POST /tenants/{tenantId}/suspend → 202 Task | tenant:suspend | 409 TENANT_NOT_ACTIVE |
| resumeTenant | POST /tenants/{tenantId}/resume → 202 Task | tenant:suspend | 409 TENANT_NOT_SUSPENDED |
| getQuotas | GET /tenants/{tenantId}/quotas | quota:read | 404 |
| updateQuotas | PUT /tenants/{tenantId}/quotas | quota:update | 409 TENANT_SUSPENDED · 422 QUOTA_BELOW_USAGE · QUOTA_EXCEEDS_PLAN (`params.resource`) |
| listVms | GET /vms?tenantId&status&q&limit&cursor | vm:read | 404 tenantId out of scope · 422 missing tenantId (provider/reseller) |
| getVm | GET /vms/{vmId} | vm:read | 404 |
| runVmAction | POST /vms/{vmId}/actions → 202 Task | vm:operate | 409 VM_BUSY · VM_INVALID_STATE · TENANT_SUSPENDED |
| listBuckets | GET /buckets?tenantId&q&limit&cursor | bucket:read | 404 tenantId out of scope · 422 missing tenantId (provider/reseller) |
| createBucket | POST /buckets → 201 | bucket:create | 409 BUCKET_NAME_TAKEN · TENANT_SUSPENDED · 422 QUOTA_EXCEEDED |
| deleteBucket | DELETE /buckets/{bucketName} → 204 | bucket:delete | 409 BUCKET_NOT_EMPTY · TENANT_SUSPENDED |
| listTasks | GET /tasks?status&resourceId&since&limit&cursor | task:read | |
| getTask | GET /tasks/{taskId} | task:read | 404 |
| events | WS /events, cookie auth (schema: `ServerEvent`, close codes `x-close-codes`) | task:read | 401 · 403 (bad `Origin`) · close 4401/4403/4429 (WS-5) |
| reportVitals | POST /rum → 204 | — (beacon; CSRF-exempt, NFR-SEC-6) | 422 · 403 (`Origin`) · rate limit 60/min per IP · 16 KB body limit |
| getVitalsSummary | GET /rum/summary | task:read | |

The storage usage card (SPEC-STO-1) uses `getQuotas` with `me.tenant.id` for tenant roles, or the picked `tenantId` for provider/reseller admins (SPEC-STO-3). VM creation (SPEC-CMP-3, stretch) needs new operations; add them to the contract first.

### 6.3 WebSocket events (`/api/events`)

Connection: `ws(s)://<app origin>/api/events`. The browser sends the session cookie on the handshake; the server checks the session and the `Origin` header. Server → client messages are a discriminated union validated with Zod:

```ts
type ServerEvent =
  | { type: 'task.updated';   task: Task }
  | { type: 'vm.updated';     vm: Pick<Vm, 'id' | 'status' | 'ip' | 'activeTaskId'> }
  | { type: 'tenant.updated'; tenant: Pick<Tenant, 'id' | 'status'> }
  | { type: 'quota.updated';  tenantId: string; quotas: TenantQuotas }   // updateQuotas, bucket create/delete, plan change, every 60 s while usage changes
  | { type: 'bucket.updated'; tenantId: string; bucket: Bucket | null; name: string } // create, delete (null), size change
  | { type: 'heartbeat';      ts: string };
```

Rules:
- **WS-1** Client reconnects with exponential backoff (1s, 2s, 4s … max 30s) plus jitter.
- **WS-2** After reconnect, client refetches active queries (resync), because events may have been missed.
- **WS-3** Events update the TanStack Query cache directly (`setQueryData`); updates arriving faster than once per animation frame are batched. Who writes which cache, and how events reach remotes, is defined in §2.5 (RT-1…9).
- **WS-4** Connection state is visible in the shell header (connected / reconnecting / offline), in an element with `role="status"` and name "Connection".
- **WS-5** Close codes (also in the contract's `x-close-codes`):

  | Code | Meaning | Client |
  |---|---|---|
  | 4401 | session missing, expired or signed out | don't reconnect → `session:expired` → `/login?reason=expired` |
  | 4403 | `Origin` rejected | don't reconnect → state `offline` → log error |
  | 4429 | too many connections | reconnect with backoff, minimum 30 s |
  | 1000 / 1001 | normal close / server going away | reconnect with backoff (WS-1) |
  | 1006 | network failure **or** HTTP 401 at the handshake (browsers can't tell them apart) | call `GET /api/me`: 401 → as 4401; otherwise reconnect with backoff |

  The server checks the session at upgrade and on every heartbeat tick (15 s). On expiry or sign-out it closes **all** of that session's sockets with 4401. A session may hold at most **5** WebSocket connections; the 6th is closed with 4429.
- **WS-6** With no message (including heartbeats) for 45 s, the client closes the socket and reconnects.
- **WS-7** Connection states: `connecting` → `connected`; on loss → `reconnecting`. It becomes `offline` after 5 consecutive failed attempts, when `navigator.onLine` is false, or on close 4403. While offline the client keeps retrying every 30 s (except after 4403). An `online` browser event triggers an immediate retry.

### 6.4 Mock API behaviour (`apps/mock-api`)

Full details (demo users, plans, seed distributions, task timings, env vars, error-code → message table) are in **`specs/mock-data.md`**. Summary:

- Seeds **10,000 tenants**, 3 resellers, 4 plans, 40 VMs and 15 buckets for the demo tenant, using a fixed random seed (deterministic tests).
- Routes are served under `/api`. Auth: `POST /api/login { role }` signs in as the demo user of that role (demo only), returns `Me` and sets the `nimbus_session` cookie (`HttpOnly; Secure; SameSite=Strict; Path=/api`). `POST /api/logout` clears it. No CORS; mutating requests need `X-Nimbus-Csrf: 1` and a same-origin `Origin` (NFR-SEC-6).
- Mode: `NIMBUS_MODE` (`dev` · `e2e` · `demo`, required) sets latency, reboot failure rate, seed and whether test endpoints exist; individual `MOCK_*` variables override it (`specs/mock-data.md` §8).
- Task runner: VM actions take 3–8 s, emit `task.updated` every 500 ms with increasing `seq`; 10% of reboots fail with `VM_BUSY` in `dev` and `demo` (0% in `e2e`).
- Latency injection: 150 ms in `dev` and `demo` to make loading states visible, 0 in `e2e` (`MOCK_LATENCY_MS` overrides).
- Remote failures are simulated outside mock-api: e2e uses Playwright route interception; the live demo uses the gateway's `FAIL_REMOTES=storage` or `POST /__test/fail-remotes` (`specs/mock-data.md` §8).

---

## 7. Feature specs

Each spec below becomes its own file in `specs/features/` (split under TECH-1; after that this section is an index, §3.1). Format: **Context → Behaviour → States → Permissions → API → Acceptance criteria → Tests**.

ACs that show text quote the message key and the expected English text (MSG-4). Keys and texts are listed in `specs/mock-data.md` §9 (error codes) and §10 (other UI messages).

#### Drawer URLs (SPEC-TEN-3, SPEC-CMP-5, SPEC-CMP-4, SPEC-STO-3)

- **Tenant drawer:** `/tenants/:tenantId?tab=…`. The path segment says which tenant; `tenantId` is never a query parameter on `/tenants`. `tab` is `overview`, `quotas` or `activity`; the default is `overview`, and the parameter is left out of the URL when it's the default. List filters stay in the URL while the drawer is open (e.g. `/tenants/t_acme?status=active&sort=-createdAt&tab=quotas`), so closing the drawer returns to the same filtered list.
- **VM drawer:** `/compute/:vmId`, with no `tab` (it has sections, not tabs).
- **`tenantId`** exists only on `/compute` and `/storage`, for admins (SPEC-CMP-4, SPEC-STO-3):
  - for tenant roles it's ignored and removed from the URL;
  - if an admin opens `/compute/vm_01` without it, compute loads the VM, then adds `?tenantId=` from `vm.tenantId`, so the list behind the drawer matches;
  - if it doesn't match the ID format (contract `ResourceId`), it's treated as missing and the picker is shown.
- Unknown parameters are kept, but have no effect.

| Action | History |
|---|---|
| Open drawer | push (Back closes it) |
| Switch tab | replace (Back doesn't step through tabs) |
| Close with ✕ | push the list URL without `tab` |
| URL corrections (invalid `tab`, adding or removing `tenantId`) | replace |

---

### SPEC-SHL-1 — Sign in and session [MVP]
**Implements:** US-1.1

**Behaviour**
- Demo login page with a role picker (4 roles) and a *Sign in* button.
- The session is the `nimbus_session` cookie (`HttpOnly; Secure; SameSite=Strict; Path=/api`) set by `login` (NFR-SEC-3, NFR-SEC-6, ADR-0005). JavaScript never reads it; the shell keeps only the `Me` returned by `login` / `getMe` in memory. Expiry is detected only by a 401 or WebSocket close 4401 (WS-5); the client never tracks an expiry time.
- **Home area** = the first permitted area in this order: Tenants → Compute → Storage. With the §5.2 matrix, provider and reseller admins get `/tenants`; tenant roles get `/compute`. `/` always redirects to the home area.
- **Boot:** on every page load the shell calls `getMe` before rendering any route. While it's pending, it shows a full-page loader (no protected content, AC-SHL-3.3). `200` → render the requested URL. `401` → go to `/login?returnTo=<requested path + query>`.
- **Sign in:** `login` returns `Me`. The shell drops `reason` and `returnTo` from the URL and navigates to `returnTo` if it's valid, otherwise to the home area. Validation: `const u = new URL(returnTo, location.origin)`; valid only if `u.origin === location.origin`, then navigate to `u.pathname + u.search + u.hash`. Permission for the target route is checked after navigation as usual (RBAC-5), so a deep link the user can't access shows the 403 page.
- **Session expired:** any 401 (shell, or `session:expired` from a remote) or WebSocket close 4401 sends the user to `/login?reason=expired&returnTo=<current path>`. The login page shows `errors.UNAUTHENTICATED` whenever `reason=expired` is present, so the message survives a reload of `/login`. Other tabs follow (SPEC-SHL-7).
- *Sign out* calls `logout` and then, whatever it returns (204, 401 or a network error), clears the in-memory session and the shell's query client, unmounts remotes (their clients go with them), closes the WebSocket, starts a new root bus (RT-10), tells other tabs (SPEC-SHL-7) and returns to `/login` (no `returnTo`).

**Acceptance criteria**
- **AC-SHL-1.1** `planned` Given a `tenant_viewer`, when they sign in, then they land on `/compute`.
- **AC-SHL-1.2** `planned` Given a `provider_admin`, when they sign in, then they land on `/tenants`.
- **AC-SHL-1.3** `planned` Given any signed-in user, when they sign out, then they land on `/login`, browser *Back* stays on `/login`, and after signing in as `tenant_viewer` no tenant rows from the previous session are shown. (Unit test: sign-out clears the shell's query client; remote clients go away with unmount.)
- **AC-SHL-1.4** `planned` Given the session expires (API returns 401; e2e uses `POST /api/__test/expire-session`), then the user is redirected to `/login?reason=expired&returnTo=<current path>` and sees `errors.UNAUTHENTICATED` "Your session expired. Please sign in again."
- **AC-SHL-1.5** `planned` Given a signed-in `tenant_admin` or `tenant_viewer`, when they open `/`, then they are redirected to `/compute`.
- **AC-SHL-1.6** `planned` Given a signed-in `provider_admin` on `/tenants/t_acme?status=active`, or a signed-in `tenant_admin` on `/compute`, when they reload the page, then they stay signed in on the same URL, with no visit to `/login`.
- **AC-SHL-1.7** `planned` Given a signed-out user, when they open `/tenants/t_acme?status=active` and sign in as `provider_admin`, then they land on `/tenants/t_acme?status=active`.
- **AC-SHL-1.8** `planned` Given `/login?returnTo=<input>`, when the user signs in as `provider_admin`, then: `/tenants?status=active` → they land on it; `//evil.example`, `/\evil.example`, `https://evil.example/x` and `javascript:alert(1)` → rejected, they land on `/tenants`; `/%2F%2Fevil.example` → they stay on the app origin (that literal path).
- **AC-SHL-1.9** `planned` After sign-in, `context.cookies()` shows `nimbus_session` with `httpOnly: true`, `secure: true`, `sameSite: 'Strict'`, `path: '/api'`, and `localStorage` / `sessionStorage` contain no value equal to the cookie's value.
- **AC-SHL-1.10** `planned` A mutating request without `X-Nimbus-Csrf`, or with a foreign `Origin`, gets 403 `FORBIDDEN` (mock-api integration test).
- **AC-SHL-1.12** `planned` Signing out after the session already expired still lands on `/login` with no error shown.
- **AC-SHL-1.13** `planned` Reloading `/tenants/t_acme?tab=quotas` through the gateway (as `provider_admin`) shows the same view.
- **AC-SHL-1.14** `planned` A request for a missing file under `/remotes/storage/` returns 404, not `index.html`.

---

### SPEC-SHL-2 — Navigation and layout [MVP]
**Implements:** US-1.2 · RBAC-3

**Behaviour**
- Left sidebar: Tenants, Compute, Storage, (Plans, stretch). Header: user menu, tenant context bar (SPEC-SHL-8), connection indicator (WS-4, WS-7), task center button with running-task count badge.
- Items are hidden if the user lacks the area's `*:read` permission.

**Acceptance criteria**
- **AC-SHL-2.1** `planned` Given a `tenant_admin`, then the sidebar shows Compute and Storage, and not Tenants.
- **AC-SHL-2.2** `planned` Given 2 running tasks, then the task center badge shows "2" and has accessible label `shell.runningTasks_other` "2 running tasks".
- **AC-SHL-2.3** `planned` All sidebar items are reachable and operable by keyboard; the current item has `aria-current="page"`.

---

### SPEC-SHL-3 — Permission handling [MVP]
**Implements:** US-1.2 · RBAC-1…6

**Acceptance criteria**
- **AC-SHL-3.1** `planned` Given a user without `tenant:read`, when they open `/tenants` directly, then the `shell.noAccess.title` "403 – No access" page is shown with a link to their home area.
- **AC-SHL-3.2** `planned` Given the UI shows an action but the API returns 403, then a toast says `errors.FORBIDDEN` "You don't have permission to do this." and no state changes.
- **AC-SHL-3.3** `planned` `<Can>` (React) and `v-can` (Vue) render nothing when the permission is missing and do not flash content before `/me` resolves.

---

### SPEC-SHL-4 — Remote isolation [MVP]
**Implements:** US-10.1 · MF-4 · MF-6

**Behaviour**
- Error boundaries live inside each remote (MF-6). A fatal `remote:error` makes the shell unmount that remote, dispose its scope and show the MF-4 panel. The shell's own boundary covers load failures and a `mount()` that throws.
- Remotes receive context changes through `update(ctx)`, including `ctx.path` (§2.4).
- Simulating failures: e2e intercepts `**/remotes/storage/**` with `page.route` (503) and restores it with `page.unroute`; the live demo uses the gateway's `FAIL_REMOTES` / `POST /__test/fail-remotes`; each remote has a `/__crash` route, present only in `development` and `e2e` builds (§2.2), that throws during render (`specs/mock-data.md` §8).

**Acceptance criteria**
- **AC-SHL-4.1** `planned` Given the storage remote fails to load, when the user opens `/storage`, then an error panel `shell.remoteUnavailable` "Storage is temporarily unavailable." with *Retry* is shown, and the sidebar and header stay usable.
- **AC-SHL-4.2** `planned` Given the storage remote fails, then `/tenants` and `/compute` each show their heading and at least one data row.
- **AC-SHL-4.3** `planned` A render error in any remote (React or Vue) results in the MF-4 panel for that remote and one logger entry naming it.
- **AC-SHL-4.4** `planned` When the remote is back (e2e: `page.unroute`) and the user clicks *Retry*, then it loads without a full page refresh.
- **AC-SHL-4.5** `planned` After the shell calls `update` with a session that no longer has `vm:operate`, compute's action buttons disappear without a remount (component test: `mountRemote` from `libs/test-utils` mounts compute, then calls `update()` with a `SessionSnapshot` without `vm:operate`).
- **AC-SHL-4.6** `planned` Browser back/forward between `/compute` and `/compute/vm_01` (SPEC-CMP-5) updates the compute view through `ctx.path`.

---

### SPEC-TEN-1 — Tenant list [MVP]
**Implements:** US-2.1, US-2.2, US-2.3 · REQ-2

**Behaviour**
- Table columns: Name, Display name, Status (badge), Plan, Storage (used / quota with bar), VM quota, Created, row actions menu.
- Server-side search (`q`, debounced 300 ms), filters (status, plan), sort (name, created, storage used).
- Infinite scroll using cursor pagination (`limit=100`), rows virtualised (TanStack Virtual). Header shows `tenants.list.count` "Showing {shown} of {total} tenants".
- Filter, sort and search state live in the URL query string (shareable links, back button works).
- Row click opens tenant detail drawer (SPEC-TEN-3).

**States**

| State | UI |
|---|---|
| Initial loading | Skeleton rows (10) |
| Empty (no tenants) | Illustration + `tenants.empty` "No tenants yet" + *Create tenant* (if `tenant:create`) |
| No results for filters | `tenants.noMatches` "No tenants match your filters" + *Clear filters* |
| Error | Inline error with the mapped message for `Problem.code` (MSG-3), *Retry* |
| Fetching next page | Spinner row at bottom |
| Background refetch | Subtle progress bar in table header; rows remain |

**Permissions:** requires `tenant:read`. *Create tenant* button requires `tenant:create`. Row menu *Suspend* requires `tenant:suspend` (disabled with tooltip otherwise, RBAC-4).

**API:** `listTenants`. Reseller scoping is server-side.

**Acceptance criteria**
- **AC-TEN-1.1** `planned` Given 10,000 tenants, when the user scrolls to the bottom repeatedly, then at most 60 table row elements (`[role="row"]` in the body) exist in the DOM at any time (blocking e2e suite). Scrolling smoothness is a target, NFR-PERF-5, not an AC.
- **AC-TEN-1.2** `planned` When the user types "acme" in search, then exactly one request is sent 300 ms after the last keystroke, and the URL contains `?q=acme`.
- **AC-TEN-1.3** `planned` When the user clicks the *Name* header, then sort toggles asc → desc, the header has the correct `aria-sort`, and the request uses `sort=name` / `sort=-name`.
- **AC-TEN-1.4** `planned` Given URL `/tenants?status=suspended&sort=-createdAt`, when the page loads, then filters and sort controls reflect the URL.
- **AC-TEN-1.5** `planned` Given a `reseller_admin`, then only their tenants appear (verified in e2e against mock API scoping).
- **AC-TEN-1.6** `planned` Given a `tenant.updated` WS event, then that row's status badge updates without refetching the list.
- **AC-TEN-1.7** `planned` Table is keyboard navigable: Tab into the grid, arrow keys move between rows, Enter opens the detail drawer.

---

### SPEC-TEN-2 — Create tenant wizard [MVP]
**Implements:** US-3.1 · REQ-3

**Behaviour**
Modal wizard with 3 steps and a step indicator:

1. **Details** — Name (slug rules from contract), Display name, Admin email.
2. **Plan & quotas** — Plan (radio cards from `listPlans`, stretch: hard-coded if plans not built), Storage quota (whole GiB input, min 1, converted to bytes by `libs/format`), VM quota (1–500). Plan sets defaults; quotas cannot exceed the plan's max.
3. **Review** — Summary of all values with *Edit* links to each step; *Create tenant*.

- Validation uses generated Zod schemas, extended with UI rules (plan max).
- *Next* validates the current step only. *Back* keeps values.
- Closing a dirty wizard asks `tenants.discardChanges` "Discard changes?".
- On submit: `createTenant` → `201 TenantCreated { tenant, task }` → close, publish `task:started` with `task` (§2.5), toast `tenants.toast.created` "Tenant {name} created.", new tenant appears at top of list (cache insert, no full refetch).
- `409 TENANT_NAME_TAKEN` → go back to step 1 with field error on Name.
- `422` → map `errors[].field` to form fields.

**Permissions:** `tenant:create`.

**Acceptance criteria**
- **AC-TEN-2.1** `planned` Given an invalid name "Acme Corp", when the user clicks *Next*, then step 1 stays open and Name shows `tenants.nameInvalid` "Use lowercase letters, numbers and hyphens."
- **AC-TEN-2.2** `planned` Given plan "Starter" (max 100 GiB), when the user enters 200 GiB, then *Next* is blocked with `errors.QUOTA_EXCEEDS_PLAN.storage` "Starter allows up to 100 GiB."
- **AC-TEN-2.3** `planned` Given valid inputs, when the user reaches Review, then all values are shown and each *Edit* link returns to the right step with values kept.
- **AC-TEN-2.4** `planned` Given the API returns 409, then the wizard returns to step 1 and Name shows `errors.TENANT_NAME_TAKEN` "This name is already taken."
- **AC-TEN-2.5** `planned` When the user submits twice quickly, then only one request is sent (button disabled while pending).
- **AC-TEN-2.6** `planned` Focus moves to the step heading on each step change; Escape triggers the discard prompt if dirty; focus returns to *Create tenant* button on close.
- **AC-TEN-2.7** `planned` The provisioning task of a new tenant appears in the task center immediately after creation.
- **AC-TEN-2.8** `planned` Given plan "Starter" (max 10 VMs), when the user enters 20, then *Next* is blocked with `errors.QUOTA_EXCEEDS_PLAN.vms` "Starter allows up to 10 VMs."

---

### SPEC-TEN-3 — Tenant detail drawer [MVP]
**Implements:** US-2.1, US-9.1

**Behaviour:** Side drawer with Overview (fields), Quotas (editable by `quota:update`; read-only text with tooltip `tenantStatus.suspendedTooltip` while the tenant is suspended, when *Resume* is the drawer's primary action, `tenant:suspend`), and Activity (recent tasks for this tenant, from `listTasks?resourceId=` cached in the tenants area, RT-4). URL `/tenants/:tenantId?tab=overview|quotas|activity` so it's linkable (§7 *Drawer URLs*). The drawer has *View VMs* (`/compute?tenantId=<id>`) and *View buckets* (`/storage?tenantId=<id>`) links (SPEC-CMP-4, SPEC-STO-3).

**Acceptance criteria**
- **AC-TEN-3.1** `planned` Opening `/tenants/t_acme` directly shows the list with the drawer open for that tenant.
- **AC-TEN-3.2** `planned` Given `quota:update`, when the user lowers storage quota below current usage, then save is blocked with `errors.QUOTA_BELOW_USAGE.storage` "Storage quota can't be lower than current usage ({used})." with `{used}` formatted by `formatBytes` (e.g. "(840 GiB)").
- **AC-TEN-3.3** `planned` Given a successful quota update, then the list row's storage bar updates (optimistic update with rollback on error).
- **AC-TEN-3.4** `planned` Given no `quota:update`, then quota fields are read-only text, not disabled inputs.
- **AC-TEN-3.6** `planned` The drawer's Activity list shows a new suspend task and its progress live.
- **AC-TEN-3.7** `planned` Opening `/tenants/<non-existent id>` shows the drawer's not-found state with `errors.NOT_FOUND` "This item no longer exists."
- **AC-TEN-3.8** `planned` `updateQuotas` emits `quota.updated` with the new values (mock-api integration test).
- **AC-TEN-3.9** `planned` A `server:quota.updated` on a fake bus updates the storage usage card with zero HTTP calls (storage component test; MSW asserts none).
- **AC-TEN-3.10** `planned` Given a reseller_admin, after saving a quota in the tenant drawer, opening `/storage?tenantId=t_acme` shows the new quota (e2e).
- **AC-TEN-3.11** `planned` For a suspended tenant, quota fields are read-only and *Resume* is shown.
- **AC-TEN-3.12** `planned` Switching drawer tabs doesn't add history entries; *Back* closes the drawer.
- **AC-TEN-3.13** `planned` `/tenants/t_acme?tab=bogus` shows Overview and the URL becomes `/tenants/t_acme`.

---

### SPEC-TEN-4 — Suspend / resume tenant [MVP]
**Implements:** US-4.1 · REQ-4

**Behaviour**
- Row menu and drawer show *Suspend* (`tenant:suspend`) for active tenants and *Resume* for suspended ones.
- Suspend opens a danger dialog explaining consequences; the user must type the tenant name to enable *Suspend tenant*.
- Calls `suspendTenant` → `202` with a task → publishes `task:started` (§2.5). The row shows status `provisioning` with spinner until `tenant.updated` arrives.

**Acceptance criteria**
- **AC-TEN-4.1** `planned` The confirm button is disabled until the typed text exactly matches the tenant name.
- **AC-TEN-4.2** `planned` After confirming, a task appears in the task center and the row status updates when the task succeeds.
- **AC-TEN-4.3** `planned` If the task fails (e2e: `POST /api/__test/fail-next-task { "kind": "tenant.suspend", "code": "INTERNAL" }`), the row reverts to `active` and a toast shows the mapped message for the task's `error.code` (MSG-3), e.g. `errors.INTERNAL` "Something went wrong on our side. Try again."
- **AC-TEN-4.4** `planned` A `reseller_admin` doesn't see *Suspend* enabled: it's disabled with tooltip `rbac.disabledTooltip` + `actions.suspendTenant` "You don't have permission to suspend tenants."
- **AC-TEN-4.5** `planned` Suspending a tenant shows its task in the task center immediately.

---

### SPEC-CMP-1 — VM list with realtime status (Vue remote) [MVP]
**Implements:** US-5.1 · REQ-5

**Behaviour**
- Table: Name, Status (badge with icon + text, never colour alone), vCPU, Memory, IP, Actions.
- Data from `listVms`; live updates from `server:vm.updated` bus events (WS-3, §2.5).
- Transitional statuses (`starting`, `stopping`, `rebooting`) show a spinner and the linked task's progress %. On mount, compute fetches `getTask` for each VM's `activeTaskId` into its own cache (RT-4).

**Acceptance criteria**
- **AC-CMP-1.1** `planned` Given a `vm.updated` event changes VM status to `stopped`, then the row updates within one animation frame of the event being processed, with no network request (unit test, `vi.useFakeTimers({ toFake: ['requestAnimationFrame'] })`).
- **AC-CMP-1.2** `planned` Given 50 `vm.updated` events arrive within one animation frame, then they result in **one** cache write (spy on `setQueriesData`; fake `requestAnimationFrame`).
- **AC-CMP-1.3** `planned` Given the WS connection drops and reconnects, then the VM list is refetched once (WS-2).
- **AC-CMP-1.4** `planned` Status changes are announced politely to screen readers via an `aria-live="polite"` region (`compute.vmNowStatus` "web-01 is now stopped."), at most one announcement per second.
- **AC-CMP-1.5** `planned` Mounting compute while a VM has an `activeTaskId` shows that task's current progress within one `getTask` call.

---

### SPEC-CMP-2 — VM actions as long-running tasks [MVP]
**Implements:** US-6.1 · REQ-6

**Behaviour**
- Actions per status: `stopped` → Start; `running` → Stop, Reboot; transitional → all disabled.
- *Stop* asks for confirmation. Start and Reboot do not (except for a provider admin acting on another tenant, SPEC-CMP-4).
- Action → `runVmAction` → `202 Task` → publish `task:started` → button area shows progress until task ends → toast on success/failure.
- `409 VM_BUSY` → toast `errors.VM_BUSY` "web-01 is busy with another operation."

**Permissions:** `vm:operate`. Without it, action buttons are hidden (toolbar context, RBAC-4).

**Acceptance criteria**
- **AC-CMP-2.1** `planned` Given a running VM, when the user clicks *Reboot*, then the status becomes `rebooting` immediately (optimistic) and progress % updates from task events.
- **AC-CMP-2.2** `planned` Given the task fails, then status reverts to the server's latest value and a toast shows the error.
- **AC-CMP-2.3** `planned` Given `tenant_viewer`, then no action buttons are rendered.
- **AC-CMP-2.4** `planned` While a VM has an active task, all its actions are disabled with tooltip `compute.operationInProgress` "Operation in progress".

---

### SPEC-CMP-4 — Compute for provider and reseller admins [MVP]
**Implements:** REQ-5, REQ-6 · §5.2

**Behaviour**
- For users with `me.tenant === null`, Compute shows a searchable tenant combobox (`listTenants`, server-scoped). The selection is in the URL (`?tenantId=t_acme`; rules in §7 *Drawer URLs*).
- Before a choice: empty state `compute.chooseTenant` "Choose a tenant to see its virtual machines."
- Actions follow the RBAC matrix unchanged: a provider_admin may operate VMs; a context line `compute.actingOnTenant` "Acting on tenant {displayName}" is shown, and **every** VM action asks for confirmation naming the tenant. A reseller_admin is read-only.
- Server scoping: a `tenantId` outside the caller's scope returns 404 `NOT_FOUND`; provider/reseller calls without `tenantId` return 422 `VALIDATION_FAILED`.
- **Suspended tenant picked:** a suspended tenant's resources are read-only for **everyone**, including provider_admin; to make changes, an admin resumes the tenant first. The server returns 409 `TENANT_SUSPENDED` for VM actions, bucket changes and quota updates on a suspended tenant, whoever calls. Compute (and Storage, SPEC-STO-3) shows an in-area banner above the table (not the global tenant-role banner of SPEC-SHL-8), `role="status"`: `tenantStatus.suspendedAdminBanner` "{tenant} is suspended. Resume it to make changes.", plus an *Open tenant* link to `/tenants/{id}` when `canOpen` allows it (`tenant:read`). All mutating actions for that tenant are disabled with tooltip `tenantStatus.suspendedTooltip` "Changes are disabled while this tenant is suspended." Tenant status comes from the area's own cached `listTenants` / `getTenant` data, updated by `server:tenant.updated` (RT-12), so the banner appears or disappears without a reload.

**Acceptance criteria**
- **AC-CMP-4.1** `planned` A provider_admin on `/compute` sees the picker and the empty state. Picking "acme" lists 40 VMs and sets `?tenantId=t_acme`.
- **AC-CMP-4.2** `planned` A reseller_admin sees their tenants' VMs without action buttons. A foreign `tenantId` shows `errors.NOT_FOUND` "This item no longer exists."
- **AC-CMP-4.3** `planned` A provider_admin's *Stop* on a tenant's VM asks for confirmation naming the tenant.
- **AC-CMP-4.4** `planned` A provider_admin with a suspended tenant picked sees the `tenantStatus.suspendedAdminBanner` banner, and every VM action is disabled with tooltip `tenantStatus.suspendedTooltip` "Changes are disabled while this tenant is suspended."
- **AC-CMP-4.5** `planned` When that tenant is resumed in another tab, the banner disappears and actions are enabled without a reload.
- **AC-CMP-4.6** `planned` `runVmAction` as provider_admin on a suspended tenant returns 409 `TENANT_SUSPENDED` (mock-api integration test).
- **AC-CMP-4.7** `planned` A tenant_admin opening `/compute?tenantId=t_other` sees their own VMs, and `tenantId` is removed from the URL.

---

### SPEC-CMP-5 — VM detail (Vue remote) [MVP]
**Implements:** US-5.1, US-6.1 · REQ-5

**Behaviour**
- Route `/compute/:vmId` (plus `?tenantId=` for provider/reseller admins, SPEC-CMP-4). A drawer over the VM list. URL and history rules: §7 *Drawer URLs*.
- Overview: name, status, vCPU, memory, disk, IP, image, created.
- Current task with progress (from compute's own cache, RT-4).
- Recent tasks: `listTasks?resourceId=` in compute's own cache.

**States:** loading, not found (`errors.NOT_FOUND` "This item no longer exists."), error.

**Acceptance criteria**
- **AC-CMP-5.1** `planned` `/compute/vm_01` opens the drawer for web-01, including after a reload.
- **AC-CMP-5.2** `planned` A non-existent VM ID shows `errors.NOT_FOUND` "This item no longer exists."
- **AC-CMP-5.3** `planned` A running task's progress updates live in the drawer.
- **AC-CMP-5.4** `planned` A provider_admin opening `/compute/vm_01` without `tenantId` ends on `/compute/vm_01?tenantId=t_acme` with the list for `acme` behind the drawer.

---

### SPEC-TSK-1 — Task center [MVP]
**Implements:** US-7.1 · REQ-7

**Behaviour**
- Header button opens a panel listing tasks: running first (with progress bar), then recent (last 24 h), each with resource name, kind, status, time.
- Live updates from `server:task.updated`. Every task upsert, from any source (`listTasks`, `task:started`, `server:task.updated`), goes through `mergeTask` (§2.5).
- Owned by the shell; areas publish `task:started` after every task-producing 2xx response (§2.5), so a task appears instantly.
- A task's *View resource* link is shown only if `canOpen` (`libs/auth`) returns a URL; otherwise the resource name is plain text.

  ```ts
  // libs/auth — pure function, no I/O
  export function canOpen(
    target: { resource: ResourceRef; tenantId: string | null },  // a Task fits as-is
    session: SessionSnapshot,
  ): string | null;                                              // app-relative URL, or null = render as text
  ```

  | `resource.type` | Returns | Requires |
  |---|---|---|
  | `tenant` | `/tenants/{id}` | `tenant:read` |
  | `vm` | `/compute/{id}`, plus `?tenantId={target.tenantId}` when `session.tenant` is null | `vm:read` |
  | `bucket` | `null` | — |

  `canOpen` doesn't check scope (whether a reseller owns that tenant): the server only sends tasks the user may see (RT-12), and a stale link ends in the "no longer exists" state. Tenant roles have no `tenant:read`, so for them a tenant task's resource name is plain text (SPEC-SHL-8).
- Failed tasks show the mapped message for `task.error.code` (MSG-3).

**Acceptance criteria**
- **AC-TSK-1.1** `planned` A task appears in the task center within 100 ms of the area receiving its 2xx response, whether or not a WebSocket update has already arrived (component test with fake timers).
- **AC-TSK-1.2** `planned` Progress bars use `role="progressbar"` with `aria-valuenow`.
- **AC-TSK-1.3** `planned` Failed tasks show the mapped message for their error code and, when `canOpen` allows, a *View resource* link.
- **AC-TSK-1.4** `planned` A `seq: 2` update followed by `task:started` (`seq: 0`) leaves the task at its `seq: 2` state (unit test).
- **AC-TSK-1.5** `planned` A `succeeded` task never changes back to `running`.
- **AC-TSK-1.6** `planned` For tenant roles, the `tenant.provision` task shows "acme" as plain text, not a link.
- **AC-TSK-1.7** `planned` *View resource* on a VM task opens that VM's drawer (SPEC-CMP-5).

---

### SPEC-STO-1 — Bucket list and usage [MVP]
**Implements:** US-8.2 · REQ-8

**Behaviour:** Usage card on top (used / quota, % bar, warning at ≥ 80%, danger at ≥ 95%; thresholds use the exact ratio, the displayed percent is floored, §9). Table: Name, Size, Objects, Versioning, Created, actions (Delete). Usage card and list update from `server:quota.updated` and `server:bucket.updated` (RT-4).

**Acceptance criteria**
- **AC-STO-1.1** `planned` Usage at 85% shows a warning style and text `storage.usagePercent` "85% of quota used" (not colour alone).
- **AC-STO-1.2** `planned` Sizes are formatted with `formatBytes` from `libs/format` (§9): binary units, one decimal place, trailing `.0` dropped, e.g. "100 GiB", "1.5 GiB", "0 B".
- **AC-STO-1.3** `planned` Empty state offers *Create bucket* only with `bucket:create`.
- **AC-STO-1.4** `planned` Creating or deleting a bucket updates the usage card and the bucket list from events.

---

### SPEC-STO-2 — Create and delete bucket [MVP]
**Implements:** US-8.1

**Behaviour**
- Create dialog: Name (S3 naming rules: 3–63 chars, lowercase, digits, dots, hyphens; no `..`; not IP-formatted), Versioning toggle.
- Delete requires typing the bucket name; only empty buckets can be deleted (`409 BUCKET_NOT_EMPTY` otherwise).

**Acceptance criteria**
- **AC-STO-2.1** `planned` Name "My_Bucket" shows the field error `storage.bucketNameInvalid` "Use 3–63 lowercase letters, numbers, dots and hyphens." before submit.
- **AC-STO-2.2** `planned` Name "192.168.1.1" is rejected with `storage.bucketNameIp` "Bucket names can't look like IP addresses."
- **AC-STO-2.3** `planned` Creating a bucket when quota is fully used (e2e: `POST /api/__test/set-usage`) shows `errors.QUOTA_EXCEEDED` "Storage quota is full. Free up space or ask an admin to raise the quota." in the dialog.
- **AC-STO-2.4** `planned` Deleting a non-empty bucket shows `errors.BUCKET_NOT_EMPTY` "Empty the bucket before deleting it."

---

### SPEC-STO-3 — Storage for provider and reseller admins [MVP]
**Implements:** REQ-8 · §5.2

**Behaviour**
- For users with `me.tenant === null`, Storage shows the same tenant combobox as SPEC-CMP-4, with the selection in `?tenantId=` (rules in §7 *Drawer URLs*).
- Before a choice: empty state `storage.chooseTenant` "Choose a tenant to see its buckets."
- The usage card uses `getQuotas(tenantId)` for the picked tenant. Bucket create/delete stays tenant_admin only (§5.2).
- Same server scoping as SPEC-CMP-4 (404 outside scope, 422 without `tenantId`), and the same suspended-tenant banner and disabled actions (SPEC-CMP-4).

**Acceptance criteria**
- **AC-STO-3.1** `planned` A provider_admin picking a tenant in Storage sees its buckets and usage card, without create/delete actions.
- **AC-STO-3.2** `planned` A reseller_admin picking one of their tenants sees its buckets and usage card, read-only.
- **AC-STO-3.3** `planned` A foreign `tenantId` in `/storage?tenantId=` shows `errors.NOT_FOUND` "This item no longer exists."

---

### SPEC-SHL-5 — Real-user monitoring [MVP]
**Implements:** US-11.1 · REQ-11

**Behaviour:** Shell registers `onLCP`, `onINP`, `onCLS` from `web-vitals` and posts them (batched, `navigator.sendBeacon`) to `/api/rum` with route and remote name. A small internal page `/_vitals` shows p75 per route.

**Acceptance criteria**
- **AC-SHL-5.1** `planned` Each metric is sent at most once per page load, flushed on `visibilitychange: hidden` or `pagehide`. (E2E triggers the flush with `page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))` after stubbing `document.visibilityState`.)
- **AC-SHL-5.2** `planned` Each record includes `metric`, `value`, `rating`, `route`, `remote`, `navigationType`.
- **AC-SHL-5.3** `planned` `/_vitals` shows p75 values over the last 24 h of records, rated good / needs-improvement / poor with web-vitals' standard thresholds (tested with records seeded via `reportVitals`).

---

### SPEC-SHL-6 — Realtime connection and EventBus [MVP]
**Implements:** US-5.1, US-7.1 · WS-1…7 · RT-1…12 (§2.5)

**Behaviour:** The shell's `libs/realtime` owns the only WebSocket, validates every message and republishes it on the root bus; each remote gets its own scope (§2.5). Close codes, heartbeat timeout and connection states follow WS-5…WS-7.

**Acceptance criteria**
- **AC-SHL-6.1** `planned` Given a `provider_admin` who visits `/tenants`, `/compute` and `/storage` in one session, then exactly one WebSocket connection has been opened and one is open (e2e: count `page.on('websocket')` in Playwright).
- **AC-SHL-6.2** `planned` An invalid message isn't published and creates exactly one `realtime.invalid_message` logger entry.
- **AC-SHL-6.3** `planned` `subscriberCount('compute')` is 0 after compute unmounts.
- **AC-SHL-6.4** `planned` (a) A subscriber added while the state is `reconnecting` receives `{ state: 'reconnecting' }` synchronously on subscribe (unit test). (b) The header element with `role="status"` and name `connections.label` "Connection" shows `connections.reconnecting` "Reconnecting…" (e2e; the server drops the caller's sockets via `POST /api/__test/drop-sockets`).
- **AC-SHL-6.5** `planned` An exception in one subscriber doesn't stop other subscribers receiving the same event, and the logger entry names the failing subscriber's scope.
- **AC-SHL-6.6** `planned` On close 4401, the client doesn't reconnect and the user lands on `/login?reason=expired` with `errors.UNAUTHENTICATED` "Your session expired. Please sign in again."
- **AC-SHL-6.7** `planned` On close 1006, the client calls `/api/me`: 401 → as AC-SHL-6.6; 200 → reconnect with backoff.
- **AC-SHL-6.8** `planned` With no message for 45 s, the client closes the socket and reconnects (unit test, fake timers).
- **AC-SHL-6.9** `planned` After 5 failed attempts the header indicator shows `connections.offline` "Offline"; it shows `connections.connected` "Connected" again after a successful retry (unit test: a fake `WebSocket` that always fails, plus fake timers; e2e covers only `reconnecting`, AC-SHL-6.4).
- **AC-SHL-6.10** `planned` Reloading `/login?reason=expired` still shows the expiry message.
- **AC-SHL-6.11** `planned` A remote publishing `server:vm.updated` throws in tests and is dropped and logged in production builds.
- **AC-SHL-6.12** `planned` After sign-out and sign-in, no subscription from the previous session receives events.
- **AC-SHL-6.13** `planned` The first successful connection doesn't publish `realtime:reconnected`; a reconnection after a drop does, exactly once.
- **AC-SHL-6.14** `planned` A tenant_admin's socket receives no events about other tenants (mock-api integration test).
- **AC-SHL-6.15** `planned` A tenant_viewer's socket receives `tenant.updated` for `t_acme` and nothing for other tenants (mock-api integration test).

---

### SPEC-SHL-7 — Multi-tab session [MVP]
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
- **AC-SHL-7.1** `planned` Signing out in tab A sends tab B to `/login` within 1 s, without user action.
- **AC-SHL-7.2** `planned` Signing in as a different role in tab A makes tab B reload and show that role's areas and actions.
- **AC-SHL-7.3** `planned` An expiry seen in tab A shows `errors.UNAUTHENTICATED` "Your session expired. Please sign in again." in tab B.
- **AC-SHL-7.4** `planned` A tab on `/login` follows a sign-in in another tab.

---

### SPEC-SHL-8 — Tenant context [MVP]
**Implements:** US-1.2 · §1.3 (tenant_viewer persona)

**Behaviour**
- Tenant roles have no `tenant:read` (§5.2). Instead `Me.tenant` carries a read-only `TenantSummary` (`id`, `displayName`, `planName`, `status`).
- A tenant context bar in the shell header for users with `me.tenant`: `shell.tenantContext` "{displayName} · {planName} · {status}", the status shown as a badge.
- `server:tenant.updated` for the user's own tenant patches `me.tenant.status` in the shell cache.
- Suspended tenant: a global banner `tenantStatus.suspendedBanner` "This tenant is suspended. You can view resources but can't change them." All mutating actions are disabled with that text as tooltip. The server enforces it too: changes to the tenant's VMs, buckets and quotas return 409 `TENANT_SUSPENDED` (`errors.TENANT_SUSPENDED` "This tenant is suspended, so changes are disabled.").
- Tenant roles don't see the reseller, plan limits beyond their own quotas, pricing, or other tenants.

**Acceptance criteria**
- **AC-SHL-8.1** `planned` A tenant_viewer sees "Acme Corporation · Business · Active" in the header.
- **AC-SHL-8.2** `planned` When their tenant becomes suspended (`tenant.updated`), the banner appears and VM and bucket actions are disabled without a reload.

---

### SPEC-SHL-9 — Messages [MVP]
**Implements:** MSG-1…4 (§9 Messages & formatting)

**Acceptance criteria**
- **AC-SHL-9.1** `planned` Every `ErrorCode` has a message (unit test over the enum).
- **AC-SHL-9.2** `planned` An unknown code shows `errors.INTERNAL` "Something went wrong on our side. Try again."
- **AC-SHL-9.3** `planned` `QUOTA_EXCEEDS_PLAN` with `{ resource: "storage", plan: "Starter", max: 107374182400 }` shows `errors.QUOTA_EXCEEDS_PLAN.storage` "Starter allows up to 100 GiB."

---

### SPEC-PLN-1 — Plans list [Stretch]
Read-only cards of plans with price per GiB and per vCPU (`Money`, formatted per §9). Requires `plan:read`.

### SPEC-CMP-3 — Create VM wizard [Stretch]
Steps: Image → Size → Network → Review. Validates against tenant VM quota; returns a `vm.create` task.

---

## 8. Design system (ui-kit)

### 8.1 Tokens (`libs/design-tokens`)
CSS custom properties consumed by both React and Vue:

```css
:root {
  --color-bg: #ffffff;        --color-surface: #f6f8fa;
  --color-text: #1d2129;      --color-text-muted: #57606a;
  --color-primary: #1f5fa8;   --color-danger: #b42318;
  --color-warning: #b54708;   --color-success: #067647;
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-6: 24px;
  --radius-sm: 4px; --radius-md: 8px;
  --font-sans: Inter, system-ui, sans-serif; --font-size-sm: 13px; --font-size-md: 14px;
  --focus-ring: 0 0 0 3px rgb(31 95 168 / 40%);
}
```
All text/background pairs meet WCAG AA contrast (checked in CI by a token test).

### 8.2 Components (React, with Vue wrappers for the subset Compute needs)

| Component | Notes | Storybook interaction test |
|---|---|---|
| Button | variants: primary, secondary, danger, ghost; `loading` state | click while loading does nothing |
| DataTable | TanStack Table + Virtual; sort headers, sticky header, row actions | keyboard row navigation, sort toggling |
| StatusBadge | icon + text per status | — |
| Dialog / ConfirmDialog | focus trap, Escape, type-to-confirm variant | confirm disabled until text matches |
| Wizard | steps, per-step validation, review | Next blocked on invalid step |
| Drawer | URL-addressable, focus management | focus returns on close |
| Toast | `aria-live`, auto-dismiss 5 s, pause on hover | — |
| ProgressBar | determinate / indeterminate | aria attributes |
| UsageBar | thresholds 80 / 95% | warning text rendered |
| EmptyState, ErrorState, Skeleton | standard states | Retry calls handler |
| Can / v-can | permission gate | renders nothing without permission |

Every component has stories for: default, loading, empty, error, disabled, long text, and RTL-safe layout (no hard-coded left/right).

---

## 9. Non-functional requirements

### Performance
- **NFR-PERF-1** Bundle budgets (gzip), enforced by `size-limit` in CI on the `production` build (§2.2):

  | Bundle | Budget |
  |---|---|
  | shell initial JS | 180 KB |
  | tenants remote | 120 KB |
  | storage remote | 80 KB |
  | compute remote (incl. Vue) | 110 KB |
  | ui-kit shared chunk | 60 KB |

- **NFR-PERF-2** Core Web Vitals targets at p75 (real users): LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1.
- **NFR-PERF-3** Remotes are lazy-loaded on first navigation; the shell prefetches a remote's entry on sidebar hover.
- **NFR-PERF-4** No route renders more than 200 table rows into the DOM at once.
- **NFR-PERF-5** While scrolling 10,000 tenants, the median of 3 throttled runs (Chromium, 4× CPU) has no long task over 50 ms. Reported by the non-blocking `ci/perf` job on every PR; a target, not an AC (NFRs aren't subject to T2/T3).

### Accessibility
- **NFR-A11Y-1** WCAG 2.2 AA. `@axe-core/playwright` runs on every e2e page; any serious/critical violation fails CI.
- **NFR-A11Y-2** Every interactive element is keyboard-operable with a visible focus ring.
- **NFR-A11Y-3** Status is never conveyed by colour alone.
- **NFR-A11Y-4** Dialogs and drawers trap focus and restore it on close.

### Security
- **NFR-SEC-1** CSP in production: `default-src 'self'; script-src 'self' <remote origins>; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'`. Remote origins come from the remote manifest (`config/remotes.*.json`, §2.2), not wildcards; `script-src` is generated from the same file.
- **NFR-SEC-2** No `dangerouslySetInnerHTML` / `v-html` (lint error unless allowlisted with a sanitiser and an ADR).
- **NFR-SEC-3** No session secret is readable by JavaScript: httpOnly, Secure, SameSite=Strict cookie (ADR-0005). No session data is ever written to `localStorage`, `sessionStorage` or IndexedDB. Reloads and deep links keep the session (AC-SHL-1.6/1.7).
- **NFR-SEC-4** All server-provided strings are rendered as text. URLs from the API are validated against an allowlist of schemes (`https:`).
- **NFR-SEC-5** Dependencies scanned in CI (`pnpm audit --prod`, fail on high).
- **NFR-SEC-6** Every mutating request to an authenticated endpoint requires `X-Nimbus-Csrf: 1` (added by `customFetch`) and a same-origin `Origin`; WebSocket upgrades with a foreign `Origin` are closed with 4403. The only exemption is `reportVitals`: unauthenticated, append-only, `Origin`-checked, rate-limited (60 requests/min per client IP), size-limited (16 KB), schema-validated (422). There is no CORS: app and API share one origin (ADR-0005).

### Reliability
- **NFR-REL-1** Each remote has an error boundary (SPEC-SHL-4).
- **NFR-REL-2** All queries have sensible `staleTime` and retry policies: retry 2× on network/5xx, never on 4xx.

### Code quality
- **NFR-CODE-1** TypeScript `strict: true`, `noUncheckedIndexedAccess: true`. No `any` without a `// reason:` comment (lint rule).
- **NFR-I18N-1** User-facing strings live in typed message catalogues (§9 Messages & formatting, MSG-1); no inline literals in JSX/templates (lint warning).

### Logging
- `libs/logger`, framework-agnostic: `logger.error | warn | info(event: string, data?: object)`.
- Output: `console` with prefix `[nimbus][<source>] <event>`, plus an in-memory ring buffer of the last 200 entries (`logger.entries()`), used by tests and a dev-only `/_debug` page.
- "Logged once" means **one entry per occurrence**, e.g. one `realtime.invalid_message` entry per invalid WebSocket message.
- Production builds keep `error` and `warn`, and drop `info`.

### Messages & formatting
- **MSG-1** Every user-facing string lives in a typed catalogue: shared strings in `libs/messages/src/en.ts` (errors, common actions, statuses, connection states), area strings in `apps/<area>/src/messages/en.ts`. A missing key is a type error.
- **MSG-2** Placeholders use `{name}` and are always inserted as text, never HTML. Plurals use `…_one` / `…_other` keys chosen with `Intl.PluralRules('en')`.
- **MSG-3** Server text is never shown. The UI shows the message for `Problem.code`, filled from `Problem.params`. Unknown codes show the `INTERNAL` message. `title` / `detail` go to the logger only (lint: `nimbus/no-server-text`).
- **MSG-4** Single source of wording: `specs/mock-data.md` §9 for error texts and §10 for other UI strings referenced by ACs. ACs quote the message key plus the expected text. A unit test checks that every `ErrorCode` has a message.

Formatting lives in `libs/format`: framework-agnostic, pure, shared by React and Vue, every function unit-tested with the examples below. Locale handling is internal (the table). ACs and messages reference these names (e.g. "`{max}` formatted with `formatBytes`").

```ts
formatBytes(bytes: number): string                      // 107374182400 → "100 GiB", 1610612736 → "1.5 GiB", 0 → "0 B"
gibToBytes(gib: number): number                         // 100 → 107374182400 (quota inputs)
bytesToGib(bytes: number): number                       // 107374182400 → 100 (prefilling inputs)
formatPercent(ratio: number): string                    // 0.799 → "79%", 1.04 → "104%"
usageLevel(ratio: number): 'ok' | 'warning' | 'danger'  // < 0.8 ok, < 0.95 warning, else danger (exact ratio)
formatCount(n: number): string                          // 10000 → "10,000"
formatDateTime(iso: string): string                     // → "30 Oct 2026, 22:01" (browser time zone)
formatRelativeTime(iso: string, now?: Date): string     // → "2 minutes ago" (< 24 h; older → formatDateTime)
formatMoney(money: Money): string                       // { amountMicros: 35000, currency: 'EUR' } → "€0.035"
```

Rules behind them:

| What | Rule | Example |
|---|---|---|
| Bytes | binary units; trailing `.0` dropped; one decimal otherwise; none for B | `100 GiB`, `1.5 GiB`, `0 B` |
| Quota input | whole GiB, converted to bytes | `100` → `107374182400` |
| Percent | display `Math.floor`; thresholds use the exact ratio | 79.9% → "79%", no warning |
| Over quota | real value, danger style | `104%` |
| Date/time | `Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })`, browser time zone; tooltip shows ISO UTC | `30 Oct 2026, 22:01` |
| Recent (< 24 h) | `Intl.RelativeTimeFormat('en', { numeric: 'auto' })` | `2 minutes ago` |
| Counts | `Intl.NumberFormat('en-GB')` | `10,000` |
| Money | `Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 4 })` on `amountMicros / 1e6` | `€0.035` |

---

## 10. Testing strategy

| Layer | Tool | Covers | Runs |
|---|---|---|---|
| Static | `tsc`, ESLint + custom rules | types, conventions, contract usage | pre-commit, agent hook, CI |
| Unit | Vitest | pure logic: formatters, permission helpers, WS batching, URL state | pre-commit (affected), CI |
| Component | Vitest + Testing Library + MSW | component behaviour with mocked API | CI |
| Interaction | Storybook `play` functions (test-runner / Vitest addon) | design-system behaviour in all states | CI |
| Contract | Zod validation of MSW + mock-api responses | mock API matches contract | CI |
| E2E | Playwright against the gateway serving `e2e`-mode builds (shell + remotes + mock-api) | user journeys, RBAC, remote isolation, a11y (axe) | CI on every PR; nightly cross-browser |
| Perf | Playwright trace + `size-limit` | long tasks during scroll (`ci/perf`, non-blocking, NFR-PERF-5), bundle budgets (`production` build) | CI |

### Rules
- **TEST-1** Test titles start with a known ID (`tools/trace/ids.ts`, §3.2).
- **TEST-2** Every bug fix PR includes a test that fails before the fix (CI runs the new test against `main` to prove it fails — stretch).
- **TEST-3** No `waitForTimeout` / fixed sleeps in Playwright; use web-first assertions (`expect(locator).toHaveText`). Lint rule enforces this.
- **TEST-4** Flaky tests are not retried into green: CI runs with `retries: 0` on PRs; a flake gets a `BUG-*` issue and a fix, not a skip.
- **TEST-5** Selectors use roles and accessible names (`getByRole`), not CSS classes or test IDs, unless no accessible name exists.
- **TEST-6** E2E runs mock-api with `NIMBUS_MODE=e2e` (seed 42, no latency, no random failures). Failure paths are forced through `/api/__test/*` endpoints, not random rates.

### E2E browsers

| Suite | Browsers | Blocking | Origin |
|---|---|---|---|
| PR e2e | Chromium | yes | `http://localhost:8080` |
| Nightly (scheduled) | Chromium, Firefox, WebKit | no; opens an issue on failure | `https://localhost:8443` (gateway with `TLS=1` and a self-signed cert; Playwright `ignoreHTTPSErrors`) |

The nightly suite runs over HTTPS, so `Secure` cookies behave the same in WebKit (ADR-0005).

### Required e2e journeys

| ID | Journey | Covers |
|---|---|---|
| E2E-1 | Provider admin searches, sorts, opens tenant, edits quota | AC-TEN-1.2/1.3, AC-TEN-3.1/3.3 |
| E2E-2 | Provider admin creates tenant incl. 409 path | AC-TEN-2.1–2.5 |
| E2E-3 | Provider admin suspends tenant, sees task complete | AC-TEN-4.1/4.2 |
| E2E-4 | Tenant admin reboots VM and sees live progress | AC-CMP-2.1, AC-TSK-1.1 |
| E2E-5 | Tenant viewer sees no actions; direct URL to /tenants shows 403 | AC-CMP-2.3, AC-SHL-3.1 |
| E2E-6 | Storage remote down (`page.route('**/remotes/storage/**')` → 503, restored with `page.unroute`); tenants and compute still work | AC-SHL-4.1/4.2/4.4 |
| E2E-7 | Tenant admin creates bucket, hits validation, deletes it | AC-STO-2.* |
| E2E-8 | Reseller sees only own tenants | AC-TEN-1.5 |
| E2E-9 | Two tabs (one context): sign out in A → B lands on `/login`; sign in as another role in A → B reloads with that role's areas; a tab on `/login` follows a sign-in | SPEC-SHL-7 (due Day 8) |
| E2E-10 | Two browser contexts: provider_admin suspends `acme` → tenant_admin's header shows "Suspended", banner appears, VM actions disabled; resume → reverts | SPEC-SHL-8, AC-CMP-4.4/4.5 (due Day 6) |
| E2E-11 | provider_admin on `/compute`: pick `acme` → open `/compute/vm_01` drawer → reboot with tenant-named confirmation → live progress → reload keeps drawer | SPEC-CMP-4, SPEC-CMP-5 (due Day 6) |
| E2E-12 | reseller_admin on `/storage`: pick own tenant → read-only buckets and usage; foreign `tenantId` → "This item no longer exists." | SPEC-STO-3 (due Day 8) |
| E2E-13 | `expire-session` → next action lands on `/login?reason=expired&returnTo=…` → reload keeps message → sign in returns to `returnTo` | SPEC-SHL-1, SPEC-SHL-6 (due Day 4) |
| E2E-14 | `drop-sockets` → header shows "Reconnecting…" then "Connected"; an event emitted after reconnect updates the UI | SPEC-SHL-6 (due Day 4) |
| E2E-15 | Deep links through the gateway: reload `/tenants/t_acme?tab=quotas`, `/compute/vm_01`, `/storage?tenantId=t_acme` (provider_admin) | AC-SHL-1.13, gateway fallback (due Day 5) |
| E2E-16 | Wizard on Starter: VM quota 20 → "Starter allows up to 10 VMs."; storage 200 GiB → "Starter allows up to 100 GiB." | SPEC-TEN-2, SPEC-SHL-9 (due Day 7) |

ACs can still be covered by unit or component tests; journeys are the end-to-end proof. Each journey is due on the day its spec is built (§14).

---

## 11. Agent harness

The harness is what makes agent output trustworthy. It is part of the product and is reviewed like code.

### 11.1 `AGENTS.md` (repo root) — required content
See `AGENTS.md`; this section only describes what it must cover: where to find the IDs for a task, the contract-first rule, the hard rules and how each is enforced, the working steps, the commands, where things live, and the summary every task ends with. Every app and every lib also has a local `AGENTS.md`, at most 30 lines, with fixed sections: purpose · framework and key libraries · what it owns (query caches, bus events it publishes) · local commands · local pitfalls. It never repeats root rules; it only adds to or narrows them for that folder. It's created in the same PR as the project itself, and updated whenever a pitfall reaches `docs/agent-log.md`.

### 11.2 Skills (`.claude/skills/`)

| Skill | What it teaches the agent |
|---|---|
| `add-table-page` | Build a list page: generated hook, DataTable, URL state, all 5 states, RBAC gates, tests per AC |
| `add-wizard` | Multi-step form with per-step Zod validation, review step, 409/422 mapping |
| `contract-change` | Edit TypeSpec → build → regenerate → fix type errors → update MSW handlers |
| `write-e2e` | Playwright conventions: role selectors, no sleeps, mock seeds, axe check |
| `reproduce-bug` | From a bug report: write failing test first (unit or e2e), then fix, then re-run against the dev stand |
| `long-running-task` | 202 + Task + WS progress + optimistic state + rollback pattern |

### 11.3 Subagents (`.claude/agents/`)

| Subagent | Role | Tools |
|---|---|---|
| `spec-reviewer` | Checks a feature spec for missing states, ambiguous ACs, missing permissions, untestable criteria **before** implementation | read-only |
| `test-writer` | Writes tests from ACs only, without reading the implementation (prevents tests that mirror bugs) | read specs + write tests |
| `code-reviewer` | Reviews a diff against AGENTS.md rules, the spec and security/a11y checklists; outputs findings with severity | read-only |
| `bug-reproducer` | Uses Playwright against the running dev stand to reproduce a reported bug and attaches a trace | Playwright MCP / shell |

### 11.4 Hooks
Implemented both as Claude Code hooks (`.claude/settings.json`) and as tool-agnostic git hooks (`lefthook.yml`), so they protect against any agent or human.

| ID | Trigger | Action |
|---|---|---|
| HOOK-1 | After any file edit by the agent | Run `nx affected -t typecheck lint` on touched projects; feed errors back to the agent |
| HOOK-2 | Before edit | **Block** writes to `libs/api-client/src/generated/**` and `contracts/openapi.yaml` (must be generated) |
| HOOK-3 | Before edit to `*.test.ts` / `*.spec.ts` | Warn if the diff removes `expect(` calls or adds `.skip`/`.only`; require justification |
| HOOK-4 | Pre-commit | `nx affected -t test` + `pnpm trace --changed` |
| HOOK-5 | Before shell command | Block `rm -rf`, `git push --force`, and edits outside the repo |
| HOOK-6 | On agent stop | Print summary: changed files, AC IDs referenced, tests added, checks passed/failed |

**Hook tests.** Every hook ships with tests, the same way bug fixes come with tests. They live in `.claude/hooks/__tests__/*.test.mjs` and run with Node's built-in runner, `node --test '.claude/hooks/__tests__/*.test.mjs'` (root script `pnpm test:hooks`). It needs no dependencies, so it works before `pnpm install`; the glob form needs Node ≥ 21 (`.nvmrc` pins 22). Lefthook runs it in pre-commit when `.claude/hooks/**` changes, and CI runs it as `ci/hooks`.

### 11.5 MCP server — `tools/mcp-spec-server`
A small Node MCP server that exposes the product knowledge base so agents query it instead of guessing.

| Tool | Input | Returns |
|---|---|---|
| `get_requirement` | ID (`REQ-3`, `SPEC-TEN-2`, `AC-TEN-2.4`) | the text plus parent/child IDs |
| `search_specs` | free text | matching spec sections with IDs |
| `get_operation` | operationId | request/response schemas, error codes, required permission |
| `get_permissions` | role or permission | RBAC matrix rows |
| `coverage_for` | AC ID | tests that cover it and last CI status |

### 11.6 Evals for skills — `tools/evals`
Purpose: prove that a change to a skill or AGENTS.md makes agent output better, not worse.

- **Fixtures:** 5 small tasks with a fixed repo snapshot each (e.g. "add a `Region` column to the tenant list", "implement AC-STO-2.2").
- **Graders (automatic):** typecheck passes · lint passes · target AC tests pass · no forbidden patterns (raw fetch, role-name checks, generated-file edits) · all 5 states present (grep for stories/tests).
- **Output:** a score table per skill version stored in `tools/evals/results/`. A skill change PR must not lower the score.

### 11.7 Review → lint loop
1. Reviewers tag repeated review comments with a label (e.g. `review:pattern`).
2. Weekly (or when a pattern hits 3 occurrences), turn it into a rule in `tools/eslint-rules/` with tests.
3. Record it in `docs/review-rules.md` (comment → rule → date).

Starter rules:

| Rule | Prevents |
|---|---|
| `nimbus/no-direct-fetch` | `fetch`/`axios` outside `libs/api-client` |
| `nimbus/no-raw-permission` | permission string literals instead of the `Permission` enum |
| `nimbus/no-role-check` | comparing `role === '…'` |
| `nimbus/no-playwright-sleep` | `waitForTimeout` in e2e |
| `nimbus/test-name-has-id` | test titles that don't start with a known ID (`tools/trace/ids.ts`) in `apps/**` |
| `nimbus/no-cross-remote-import` | importing one remote from another (MF-3) |
| `nimbus/no-websocket-outside-realtime` | `new WebSocket` outside `libs/realtime` (RT-1) |
| `nimbus/no-handwritten-query-key` | query keys not built with Orval's generated helpers (RT-4) |
| `nimbus/no-server-text` | rendering `problem.title` / `problem.detail` (MSG-3) |

---

## 12. CI/CD pipeline

`.github/workflows/ci.yml` — runs on every PR:

```
job id                step
ci/install            1. install (pnpm, cached)
ci/contract-check     2. contract:check   — openapi.yaml & generated client up to date (git diff --exit-code)
ci/trace-check        3. trace:check      — rules T1–T6 (§3.3); planned ACs reported, never failing
ci/affected           4. nx affected -t lint typecheck test        (parallel)
ci/storybook-test     5. storybook:test   — interaction tests for affected libs
ci/build              6. build            — all apps
ci/size               7. size             — `pnpm size` (size-limit): bundle budgets on the production build (NFR-PERF-1)
ci/hooks              3b. hooks           — `pnpm test:hooks`: tests for `.claude/hooks/*` (§11.4)
ci/no-test-hooks      7b. no-test-hooks   — build production; fail if `__crash` or `/__test/` appears in any bundle (§2.2)
ci/e2e                8. e2e              — build --mode e2e, start mock-api + gateway (:8080), run Playwright on Chromium (+ axe), upload traces on failure
ci/perf               —  perf (non-blocking) — NFR-PERF-5 long-task measurement; reports, never fails the PR
ci/report             9. report           — post comment: coverage of ACs, bundle size diff, perf report, failed traces
```

Main branch: same + Storybook publish. Nightly (scheduled): `ci/nightly-e2e` runs the e2e suite on Chromium, Firefox and WebKit against `https://localhost:8443`; non-blocking, opens an issue on failure (§10). Preview deploy (stretch) is **one container** (gateway + mock-api + built assets) on a single host, so app and API stay same-origin (ADR-0005).

---

## 13. Architecture Decision Records

Write each as `docs/adr/ADR-000x-title.md` with **Context · Options · Decision · Consequences**. Each ADR is written on the day its decision is first implemented, **in the same PR**.

| ADR | Decision | Written |
|---|---|---|
| ADR-0001 | Module Federation (Vite plugin) over iframes and over build-time packages, for independent deploys with shared dependencies | exists |
| ADR-0002 | Framework-agnostic `mount(el, ctx)` remote contract so Vue and React remotes coexist (path for migrating a Vue monolith) | Day 1 |
| ADR-0003 | TypeSpec as contract source of truth, compiled to OpenAPI; clients, Zod and MSW generated by Orval | Day 2 |
| ADR-0004 | TanStack Query for server state; WS events write into the query cache rather than a separate store | Day 4 |
| ADR-0005 | Same-origin gateway + httpOnly `Secure; SameSite=Strict` session cookie with CSRF header and `Origin` checks; rejected: in-memory token, cross-site `SameSite=None` cookies with CSRF tokens | exists |
| ADR-0006 | Permission-based (not role-based) UI checks; UI is never the security boundary | Day 3 |
| ADR-0007 | Test pyramid and zero-retry policy for PRs | Day 1 |

---

## 14. Build plan & milestones

Target: **9 working days** to a demo-ready state. Each day ends with green CI; ACs not yet started stay `planned` and don't block CI (T5). Before building, each day runs the spec-reviewer **only on that day's specs**, plus any deferred section-C findings in those areas (`docs/decisions/SPEC-REVIEW-v1.4-decisions.md`).

| Day | Milestone |
|---|---|
| 1 | Spec split into `specs/features/` (first commit) · workspace, gateway, shell + 3 remotes, MF, e2e smoke against 8080 · hooks + lefthook · CI |
| 2 | Contract package · generated clients · shared libs (logger, messages, format) · mock-api with cookie session, CSRF, test endpoints |
| 3 | SPEC-SHL-1/2/3 (sign-in, nav, RBAC, 403) · SPEC-SHL-9 (messages wiring) · ui-kit basics + Storybook |
| 4 | Realtime: `libs/realtime`, root and scoped bus, WS client and close codes (SPEC-SHL-6) · SPEC-TSK-1 task center |
| 5 | SPEC-TEN-1 tenant list · SPEC-TEN-3 drawer |
| 6 | SPEC-CMP-1/2 VM list and actions (Vue) · SPEC-CMP-5 VM detail · SPEC-SHL-8 tenant context |
| 7 | SPEC-TEN-2 wizard · SPEC-TEN-4 suspend/resume · SPEC-SHL-4 isolation |
| 8 | SPEC-STO-1/2 storage · SPEC-CMP-4 and SPEC-STO-3 admin tenant context · SPEC-SHL-7 multi-tab |
| 9 | Harness (skills, subagents, MCP server, evals, lint rules) · size budgets · RUM · README · demo rehearsal (ADRs are written on their own days, §13) |

**Cut order if time runs out:** SPEC-SHL-7 multi-tab → `/_vitals` page → eval fixtures (keep 1) → SPEC-STO-3 → SPEC-TEN-3 quota editing → storage delete flow.
**Never cut:** contract generation, RBAC, cookie session, realtime + tasks, e2e in CI, AGENTS.md + hooks.

### 14.1 Engineering tasks (`TECH-*`)

TECH items, their statuses and how each one is verified live in **`specs/tech-tasks.md`** (§3.1).

---

## 15. Interview demo script (≈ 8 minutes)

Start the stack with `pnpm demo:local` (e2e build mode, `NIMBUS_MODE=e2e`, `MOCK_LATENCY_MS=150`, `MOCK_FAILURE_RATE=0.1`): realistic latency and failures, and the `/__test/fail-remotes` toggle works. `NIMBUS_MODE=demo` is only for the public preview deploy, where test endpoints stay off.

1. **Spec → code trace (1 min).** Open `specs/features/SPEC-TEN-2.md`, show an AC, run `pnpm trace` and jump to the test named `AC-TEN-2.4`.
2. **Contract-first (1 min).** Add a field in `main.tsp`, regenerate, show the TypeScript error appear in the tenant table until it's handled.
3. **App tour (2 min).** Sign in as provider admin → scroll 10k tenants → create tenant (show the 409 path) → sign in as tenant admin → reboot a VM in the **Vue** remote and watch progress in the **React** shell's task center.
4. **Resilience (30 s).** Toggle the gateway with `POST /__test/fail-remotes { "remotes": ["storage"] }`; Storage shows an error panel, everything else works. Toggle it back and click *Retry*.
5. **Harness (2 min).** Ask the agent to "add a Region column to tenants". Show: it queries the MCP spec server, HOOK-2 blocks it from editing generated code, the lint rule catches a raw `fetch`, and the hook feeds the error back so it fixes itself.
6. **Quality gates (1 min).** Open a PR: CI shows AC coverage, bundle size diff, Playwright traces and axe results.
7. **What I'd do next (30 s).** Point to the ADRs and the README section "Where the agent failed and what I changed": a short curated summary of the 5–8 best incidents from `docs/agent-log.md`, with a link to the full log.

---

## 16. Definition of Done

A feature is done when:

- [ ] Its specs passed **that day's spec check** with no open findings (AGENTS.md §1a).
- [ ] Contract changed first if needed; generated code untouched; `ci/contract-check` passes.
- [ ] Every AC it implements has status `done` and at least one passing test whose title starts with the AC ID; `pnpm trace` passes T1–T6.
- [ ] Its e2e journeys (§10) pass on Chromium against the gateway.
- [ ] Loading, empty, error and no-permission states exist, each with a story.
- [ ] All user-facing text comes from message catalogues; none of it is marked `draft`.
- [ ] Keyboard and screen-reader checks pass; axe reports no serious or critical issues.
- [ ] `ci/size` passes on the production build, and `ci/no-test-hooks` passes.
- [ ] No new lint suppressions without a `reason:` comment.
- [ ] The PR lists **Implements:** IDs and notes agent mistakes caught (for `docs/agent-log.md`).
- [ ] CI green with zero retries.
