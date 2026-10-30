# Nimbus Console — Product & Engineering Spec

> **What this is.** A demo repository spec for a mock multi-tenant cloud admin portal, built to show the exact workflow of a spec-first, contract-first, agent-assisted frontend team.
> **Who reads it.** Humans *and* coding agents. Every requirement has a stable ID; every test, PR and commit references the IDs it implements.
> **Status:** v1.0 · Owner: Rasul Idiev · Last updated: 2026-10-30

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

1. Never write code for something that has no `SPEC-*` ID. If it's missing, write the spec first.
2. Any API change starts in `contracts/` (Section 6), then you regenerate clients. Never hand-edit `libs/api-client/src/generated/**`.
3. Every acceptance criterion (`AC-*`) has at least one test whose name contains that ID.
4. Every bug fix starts with a failing test named `BUG-<n>: …`.
5. Agents must read `AGENTS.md` and the relevant `SPEC-*` section before editing code.

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

| Concern | Choice |
|---|---|
| Monorepo | Nx + pnpm workspaces |
| Build / dev server | Vite |
| Micro-frontends | Module Federation via `@module-federation/vite` |
| Host + 2 remotes | React 18+ · TypeScript (strict) |
| 1 remote | Vue 3 (Composition API) · TypeScript (strict) |
| Server state | TanStack Query (React and Vue adapters) |
| Client state | Zustand (React), Pinia (Vue) — only for UI state |
| Routing | React Router (shell + React remotes), Vue Router (compute remote, memory-history inside host) |
| Tables | TanStack Table + TanStack Virtual |
| Forms & validation | React Hook Form + Zod (generated schemas) |
| Contract | TypeSpec → OpenAPI 3.1 |
| Client generation | Orval → typed fetch client, TanStack Query hooks, Zod schemas, MSW handlers |
| Mock backend | Fastify + `@fastify/websocket`, in-memory seeded data |
| Unit/component tests | Vitest + Testing Library |
| Component workshop | Storybook (React + Vue) with interaction tests (`play` functions) |
| E2E | Playwright |
| Lint/format | ESLint (flat config) + custom rules, Prettier |
| Bundle budgets | `size-limit` per remote |
| RUM | `web-vitals` library → `/rum` endpoint |
| CI | GitHub Actions |

### 2.2 Runtime diagram

```
┌──────────────────────────── Browser ─────────────────────────────┐
│  apps/shell (React host)                                         │
│   ├─ auth/session, nav, layout, task center, error boundaries    │
│   ├─ loads remote: tenants  (React)  ── /tenants/*               │
│   ├─ loads remote: storage  (React)  ── /storage/*               │
│   └─ loads remote: compute  (Vue 3)  ── /compute/*  via mount()  │
└───────────────┬───────────────────────────────┬──────────────────┘
                │ REST (generated client)       │ WebSocket /events
                ▼                               ▼
          apps/mock-api (Fastify, in-memory DB, task runner)
```

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
│  └─ features/SPEC-*.md          # one file per feature spec (split from Section 7)
├─ docs/adr/ADR-000x-*.md
├─ apps/
│  ├─ shell/                      # React host
│  ├─ tenants/                    # React remote
│  ├─ storage/                    # React remote
│  ├─ compute/                    # Vue remote
│  ├─ mock-api/                   # Fastify + ws
│  └─ e2e/                        # Playwright
├─ libs/
│  ├─ api-client/                 # generated (React + Vue query hooks, zod, msw)
│  ├─ auth/                       # session + permission helpers (framework-agnostic core)
│  ├─ ui-kit/                     # React design system + tokens
│  ├─ ui-kit-vue/                 # Vue wrappers using the same tokens
│  ├─ design-tokens/              # CSS variables (single source)
│  ├─ mf-contract/                # types for remote mount/unmount + shared events
│  └─ test-utils/
├─ tools/
│  ├─ eslint-rules/               # custom lint rules from review loop
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
  session: SessionSnapshot;         // user, tenantId, permissions[]
  navigate: (to: string) => void;   // shell owns the URL
  queryClient?: unknown;            // shared only for React remotes
  events: EventBus;                 // typed cross-remote events
}

export interface RemoteModule {
  mount(el: HTMLElement, ctx: RemoteContext): { unmount(): void; update(ctx: RemoteContext): void };
}
```

Rules:
- **MF-1** The shell owns the browser URL. Remotes use memory routing synced through `navigate`.
- **MF-2** Shared singletons: `react`, `react-dom`, `@tanstack/react-query`, `@nimbus/design-tokens`. Vue is shared only within the compute remote.
- **MF-3** Remotes never import from each other. Cross-remote communication only goes through `EventBus` with typed events.
- **MF-4** A remote that fails to load or throws shows a contained error panel with *Retry*; the rest of the shell keeps working.

---

## 3. Traceability scheme

| Prefix | Level | Example | Lives in |
|---|---|---|---|
| `REQ-<n>` | Product requirement | `REQ-4` | `specs/requirements.md` |
| `US-<n>.<m>` | User story | `US-4.2` | `specs/stories/` |
| `SPEC-<AREA>-<n>` | Feature spec | `SPEC-TEN-2` | `specs/features/` |
| `AC-<AREA>-<n>.<m>` | Acceptance criterion | `AC-TEN-2.3` | inside feature spec |
| `NFR-<TOPIC>-<n>` | Non-functional requirement | `NFR-PERF-2` | Section 9 |
| `ADR-<nnnn>` | Architecture decision | `ADR-0002` | `docs/adr/` |
| `BUG-<n>` | Bug | `BUG-7` | GitHub issue |

Areas: `SHL` shell · `TEN` tenants · `STO` storage · `CMP` compute · `TSK` tasks · `RBAC` permissions.

**Conventions**
- Test names start with the ID: `it('AC-TEN-2.3: blocks Next when quota exceeds plan limit', …)`.
- Commit messages: `feat(tenants): create wizard [SPEC-TEN-2]`.
- PR template has a required **Implements:** field listing IDs; CI fails if empty (`tools/check-trace.ts`).
- `pnpm trace` prints a matrix: each AC → tests that cover it → pass/fail. Any AC without a test fails CI.

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
| tenant:read | ✅ all | ✅ own | ✅ self | ✅ self |
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

Scope (all / own / self) is enforced by the **API**. The UI only hides or disables; it is never the security boundary (`RBAC-2`).

### 5.3 UI rules
- **RBAC-1** Use `can('tenant:suspend')` / `<Can permission="…">` / `v-can="'…'"` — never compare role names.
- **RBAC-2** The UI is not a security boundary. Every mutating API call can still return `403`; handle it (`AC-SHL-3.2`).
- **RBAC-3** Navigation items are hidden when the user lacks the area's `*:read` permission.
- **RBAC-4** Actions the user can't perform are **hidden** in toolbars; in contexts where the user should know the action exists (e.g. row menu), they're **disabled with a tooltip** "You don't have permission to …".
- **RBAC-5** Directly visiting a URL without permission shows a *403 – No access* page, not a blank screen.
- **RBAC-6** Permission string constants come from the generated contract enum `Permission`; hard-coded strings are a lint error (`nimbus/no-raw-permission`).

---

## 6. API contract

### 6.1 Principles
- **API-1** Contract-first: change `contracts/main.tsp` → `pnpm contract:build` → `pnpm api:generate`. CI fails if `openapi.yaml` or generated code is out of date.
- **API-2** All errors use RFC 9457 `application/problem+json`: `{ type, title, status, detail, code, errors? }`.
- **API-3** Lists use cursor pagination: `?limit=50&cursor=…` → `{ items, nextCursor, total }`.
- **API-4** Long operations return `202 Accepted` with a `Task`; progress arrives over WebSocket and via `GET /tasks/{id}`.
- **API-5** All responses are validated at runtime with generated Zod schemas in dev and test; in production validation failures are logged, not thrown.
- **API-6** Breaking contract changes require an ADR.

### 6.2 Resources (OpenAPI excerpt)

```yaml
openapi: 3.1.0
info: { title: Nimbus API, version: 1.0.0 }
paths:
  /me:
    get: { operationId: getMe, responses: { '200': { $ref: '#/components/responses/Me' } } }

  /tenants:
    get:
      operationId: listTenants
      parameters:
        - { name: q, in: query, schema: { type: string, maxLength: 100 } }
        - { name: status, in: query, schema: { $ref: '#/components/schemas/TenantStatus' } }
        - { name: planId, in: query, schema: { type: string } }
        - { name: sort, in: query, schema: { type: string, enum: [name, -name, createdAt, -createdAt, storageUsed, -storageUsed] } }
        - { name: limit, in: query, schema: { type: integer, minimum: 1, maximum: 200, default: 50 } }
        - { name: cursor, in: query, schema: { type: string } }
      responses: { '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/TenantPage' } } } } }
    post:
      operationId: createTenant
      requestBody: { content: { application/json: { schema: { $ref: '#/components/schemas/TenantCreate' } } } }
      responses:
        '201': { description: Created, content: { application/json: { schema: { $ref: '#/components/schemas/Tenant' } } } }
        '409': { $ref: '#/components/responses/Problem' }   # name taken
        '422': { $ref: '#/components/responses/Problem' }   # validation

  /tenants/{tenantId}:
    get: { operationId: getTenant }
    patch: { operationId: updateTenant }
  /tenants/{tenantId}/suspend:
    post: { operationId: suspendTenant, responses: { '202': { $ref: '#/components/responses/TaskAccepted' } } }
  /tenants/{tenantId}/resume:
    post: { operationId: resumeTenant, responses: { '202': { $ref: '#/components/responses/TaskAccepted' } } }
  /tenants/{tenantId}/quotas:
    get:  { operationId: getQuotas }
    put:  { operationId: updateQuotas }

  /vms:
    get: { operationId: listVms }          # scoped to current tenant
  /vms/{vmId}/actions:
    post:
      operationId: runVmAction
      requestBody: { content: { application/json: { schema: { type: object, required: [action], properties: { action: { enum: [start, stop, reboot] } } } } } }
      responses: { '202': { $ref: '#/components/responses/TaskAccepted' }, '409': { $ref: '#/components/responses/Problem' } }

  /buckets:
    get:  { operationId: listBuckets }
    post: { operationId: createBucket }
  /buckets/{bucketName}:
    delete: { operationId: deleteBucket }

  /tasks:
    get: { operationId: listTasks }
  /tasks/{taskId}:
    get: { operationId: getTask }

  /plans:
    get: { operationId: listPlans }

  /rum:
    post: { operationId: reportVitals }

components:
  schemas:
    Permission: { type: string, enum: [tenant:read, tenant:create, tenant:update, tenant:suspend, quota:read, quota:update, vm:read, vm:operate, vm:create, bucket:read, bucket:create, bucket:delete, task:read, plan:read] }
    Me:
      type: object
      required: [user, permissions]
      properties:
        user: { type: object, properties: { id: { type: string }, name: { type: string }, email: { type: string, format: email } } }
        tenantId: { type: [string, 'null'] }
        resellerId: { type: [string, 'null'] }
        permissions: { type: array, items: { $ref: '#/components/schemas/Permission' } }
    TenantStatus: { type: string, enum: [active, suspended, provisioning, error] }
    Tenant:
      type: object
      required: [id, name, status, planId, createdAt, storageUsedBytes, storageQuotaBytes]
      properties:
        id: { type: string }
        name: { type: string, minLength: 3, maxLength: 63, pattern: '^[a-z0-9][a-z0-9-]*[a-z0-9]$' }
        displayName: { type: string, maxLength: 120 }
        status: { $ref: '#/components/schemas/TenantStatus' }
        planId: { type: string }
        resellerId: { type: [string, 'null'] }
        createdAt: { type: string, format: date-time }
        storageUsedBytes: { type: integer, minimum: 0 }
        storageQuotaBytes: { type: integer, minimum: 0 }
        vmQuota: { type: integer, minimum: 0 }
    TenantCreate:
      type: object
      required: [name, planId, storageQuotaBytes, vmQuota]
      properties:
        name: { $ref: '#/components/schemas/Tenant/properties/name' }
        displayName: { type: string, maxLength: 120 }
        adminEmail: { type: string, format: email }
        planId: { type: string }
        storageQuotaBytes: { type: integer, minimum: 1073741824 }   # ≥ 1 GiB
        vmQuota: { type: integer, minimum: 1, maximum: 500 }
    TenantPage:
      type: object
      required: [items, total]
      properties:
        items: { type: array, items: { $ref: '#/components/schemas/Tenant' } }
        nextCursor: { type: [string, 'null'] }
        total: { type: integer }
    VmStatus: { type: string, enum: [running, stopped, starting, stopping, rebooting, error] }
    Vm:
      type: object
      required: [id, name, status, vcpus, memoryMiB, ip]
      properties:
        id: { type: string }
        name: { type: string }
        status: { $ref: '#/components/schemas/VmStatus' }
        vcpus: { type: integer }
        memoryMiB: { type: integer }
        ip: { type: [string, 'null'] }
        activeTaskId: { type: [string, 'null'] }
    Bucket:
      type: object
      required: [name, createdAt, sizeBytes, objectCount, versioning]
      properties:
        name: { type: string, minLength: 3, maxLength: 63, pattern: '^[a-z0-9][a-z0-9.-]*[a-z0-9]$' }
        createdAt: { type: string, format: date-time }
        sizeBytes: { type: integer }
        objectCount: { type: integer }
        versioning: { type: boolean }
    TaskStatus: { type: string, enum: [queued, running, succeeded, failed] }
    Task:
      type: object
      required: [id, kind, status, progress, createdAt, resource]
      properties:
        id: { type: string }
        kind: { type: string, enum: [vm.start, vm.stop, vm.reboot, tenant.suspend, tenant.resume, tenant.provision] }
        status: { $ref: '#/components/schemas/TaskStatus' }
        progress: { type: integer, minimum: 0, maximum: 100 }
        resource: { type: object, properties: { type: { type: string }, id: { type: string }, name: { type: string } } }
        error: { $ref: '#/components/schemas/Problem' }
        createdAt: { type: string, format: date-time }
        finishedAt: { type: [string, 'null'], format: date-time }
    Problem:
      type: object
      required: [title, status, code]
      properties:
        type: { type: string }
        title: { type: string }
        status: { type: integer }
        detail: { type: string }
        code: { type: string }        # e.g. TENANT_NAME_TAKEN, QUOTA_EXCEEDED, VM_BUSY, FORBIDDEN
        errors: { type: array, items: { type: object, properties: { field: { type: string }, message: { type: string } } } }
```

### 6.3 WebSocket events (`/events`)

Connection: `ws(s)://<api>/events?token=<session>`. Server → client messages are a discriminated union validated with Zod:

```ts
type ServerEvent =
  | { type: 'task.updated';   task: Task }
  | { type: 'vm.updated';     vm: Pick<Vm, 'id' | 'status' | 'ip' | 'activeTaskId'> }
  | { type: 'tenant.updated'; tenant: Pick<Tenant, 'id' | 'status'> }
  | { type: 'heartbeat';      ts: string };
```

Rules:
- **WS-1** Client reconnects with exponential backoff (1s, 2s, 4s … max 30s) plus jitter.
- **WS-2** After reconnect, client refetches active queries (resync), because events may have been missed.
- **WS-3** Events update the TanStack Query cache directly (`setQueryData`); updates arriving faster than once per animation frame are batched.
- **WS-4** Connection state is visible in the shell header (connected / reconnecting / offline).

### 6.4 Mock API behaviour (`apps/mock-api`)
- Seeds **10,000 tenants**, 3 resellers, 4 plans, 40 VMs and 15 buckets for the demo tenant, using a fixed random seed (deterministic tests).
- Auth: `POST /login { role }` returns a token for a demo user of that role (demo only).
- Task runner: VM actions take 3–8 s, emit `task.updated` every 500 ms; 10% of reboots fail with `VM_BUSY` (disabled when `MOCK_FAILURE_RATE=0` for e2e).
- Latency injection: `MOCK_LATENCY_MS` (default 150) to make loading states visible.
- Chaos switch: `MOCK_FAIL_REMOTE=storage` makes the storage `remoteEntry.js` return 500 (for `AC-SHL-4.*`).

---

## 7. Feature specs

Each spec below becomes its own file in `specs/features/`. Format: **Context → Behaviour → States → Permissions → API → Acceptance criteria → Tests**.

---

### SPEC-SHL-1 — Sign in and session [MVP]
**Implements:** US-1.1

**Behaviour**
- Demo login page with a role picker (4 roles) and a *Sign in* button.
- On success, the shell calls `getMe`, stores the session in memory (not `localStorage`; see `NFR-SEC-3`), and redirects to the first permitted area in this order: Tenants → Compute → Storage.
- *Sign out* clears the session and query cache and returns to login.

**Acceptance criteria**
- **AC-SHL-1.1** Given a `tenant_viewer`, when they sign in, then they land on `/compute`.
- **AC-SHL-1.2** Given a `provider_admin`, when they sign in, then they land on `/tenants`.
- **AC-SHL-1.3** Given any signed-in user, when they sign out, then protected routes redirect to `/login` and no cached tenant data remains.
- **AC-SHL-1.4** Given a session token expires (API returns 401), then the user is redirected to `/login` with message "Your session expired".

---

### SPEC-SHL-2 — Navigation and layout [MVP]
**Implements:** US-1.2 · RBAC-3

**Behaviour**
- Left sidebar: Tenants, Compute, Storage, (Plans, stretch). Header: user menu, connection indicator (WS-4), task center button with running-task count badge.
- Items are hidden if the user lacks the area's `*:read` permission.

**Acceptance criteria**
- **AC-SHL-2.1** Given a `tenant_admin`, then the sidebar shows Compute and Storage, and not Tenants.
- **AC-SHL-2.2** Given 2 running tasks, then the task center badge shows "2" and has accessible label "2 running tasks".
- **AC-SHL-2.3** All sidebar items are reachable and operable by keyboard; the current item has `aria-current="page"`.

---

### SPEC-SHL-3 — Permission handling [MVP]
**Implements:** US-1.2 · RBAC-1…6

**Acceptance criteria**
- **AC-SHL-3.1** Given a user without `tenant:read`, when they open `/tenants` directly, then a *403 – No access* page is shown with a link to their home area.
- **AC-SHL-3.2** Given the UI shows an action but the API returns 403, then a toast says "You don't have permission to do this" and no state changes.
- **AC-SHL-3.3** `<Can>` (React) and `v-can` (Vue) render nothing when the permission is missing and do not flash content before `/me` resolves.

---

### SPEC-SHL-4 — Remote isolation [MVP]
**Implements:** US-10.1 · MF-4

**Acceptance criteria**
- **AC-SHL-4.1** Given the storage remote fails to load, when the user opens `/storage`, then an error panel "Storage is temporarily unavailable" with *Retry* is shown, and the sidebar and header stay usable.
- **AC-SHL-4.2** Given the storage remote fails, then `/tenants` and `/compute` still load and work.
- **AC-SHL-4.3** Given a remote throws at render, then the error is caught by that remote's error boundary and reported to the console logger with the remote name.
- **AC-SHL-4.4** When the user clicks *Retry* and the remote is back, then it loads without a full page refresh.

---

### SPEC-TEN-1 — Tenant list [MVP]
**Implements:** US-2.1, US-2.2, US-2.3 · REQ-2

**Behaviour**
- Table columns: Name, Display name, Status (badge), Plan, Storage (used / quota with bar), VM quota, Created, row actions menu.
- Server-side search (`q`, debounced 300 ms), filters (status, plan), sort (name, created, storage used).
- Infinite scroll using cursor pagination (`limit=100`), rows virtualised (TanStack Virtual). Header shows "Showing N of total".
- Filter, sort and search state live in the URL query string (shareable links, back button works).
- Row click opens tenant detail drawer (SPEC-TEN-3).

**States**

| State | UI |
|---|---|
| Initial loading | Skeleton rows (10) |
| Empty (no tenants) | Illustration + "No tenants yet" + *Create tenant* (if `tenant:create`) |
| No results for filters | "No tenants match your filters" + *Clear filters* |
| Error | Inline error with problem `title`, *Retry* |
| Fetching next page | Spinner row at bottom |
| Background refetch | Subtle progress bar in table header; rows remain |

**Permissions:** requires `tenant:read`. *Create tenant* button requires `tenant:create`. Row menu *Suspend* requires `tenant:suspend` (disabled with tooltip otherwise, RBAC-4).

**API:** `listTenants`. Reseller scoping is server-side.

**Acceptance criteria**
- **AC-TEN-1.1** Given 10,000 tenants, when the user scrolls to the bottom repeatedly, then no more than ~60 row DOM nodes exist at any time and scrolling stays smooth (no long task > 50 ms during scroll in the perf test).
- **AC-TEN-1.2** When the user types "acme" in search, then exactly one request is sent 300 ms after the last keystroke, and the URL contains `?q=acme`.
- **AC-TEN-1.3** When the user clicks the *Name* header, then sort toggles asc → desc, the header has the correct `aria-sort`, and the request uses `sort=name` / `sort=-name`.
- **AC-TEN-1.4** Given URL `/tenants?status=suspended&sort=-createdAt`, when the page loads, then filters and sort controls reflect the URL.
- **AC-TEN-1.5** Given a `reseller_admin`, then only their tenants appear (verified in e2e against mock API scoping).
- **AC-TEN-1.6** Given a `tenant.updated` WS event, then that row's status badge updates without refetching the list.
- **AC-TEN-1.7** Table is keyboard navigable: Tab into the grid, arrow keys move between rows, Enter opens the detail drawer.

---

### SPEC-TEN-2 — Create tenant wizard [MVP]
**Implements:** US-3.1 · REQ-3

**Behaviour**
Modal wizard with 3 steps and a step indicator:

1. **Details** — Name (slug rules from contract), Display name, Admin email.
2. **Plan & quotas** — Plan (radio cards from `listPlans`, stretch: hard-coded if plans not built), Storage quota (GiB input, min 1), VM quota (1–500). Plan sets defaults; quotas cannot exceed the plan's max.
3. **Review** — Summary of all values with *Edit* links to each step; *Create tenant*.

- Validation uses generated Zod schemas, extended with UI rules (plan max).
- *Next* validates the current step only. *Back* keeps values.
- Closing a dirty wizard asks "Discard changes?".
- On submit: `createTenant` → `201` → close, toast "Tenant <name> created", new tenant appears at top of list (cache insert, no full refetch). Provisioning task appears in task center.
- `409 TENANT_NAME_TAKEN` → go back to step 1 with field error on Name.
- `422` → map `errors[].field` to form fields.

**Permissions:** `tenant:create`.

**Acceptance criteria**
- **AC-TEN-2.1** Given an invalid name "Acme Corp", when the user clicks *Next*, then step 1 stays open and Name shows "Use lowercase letters, numbers and hyphens".
- **AC-TEN-2.2** Given plan "Starter" (max 100 GiB), when the user enters 200 GiB, then *Next* is blocked with "Starter allows up to 100 GiB".
- **AC-TEN-2.3** Given valid inputs, when the user reaches Review, then all values are shown and each *Edit* link returns to the right step with values kept.
- **AC-TEN-2.4** Given the API returns 409, then the wizard returns to step 1 and Name shows "This name is already taken".
- **AC-TEN-2.5** When the user submits twice quickly, then only one request is sent (button disabled while pending).
- **AC-TEN-2.6** Focus moves to the step heading on each step change; Escape triggers the discard prompt if dirty; focus returns to *Create tenant* button on close.

---

### SPEC-TEN-3 — Tenant detail drawer [MVP]
**Implements:** US-2.1, US-9.1

**Behaviour:** Side drawer with Overview (fields), Quotas (editable by `quota:update`), and Activity (recent tasks for this tenant). URL `/tenants/:id` so it's linkable.

**Acceptance criteria**
- **AC-TEN-3.1** Opening `/tenants/t_123` directly shows the list with the drawer open for that tenant.
- **AC-TEN-3.2** Given `quota:update`, when the user lowers storage quota below current usage, then save is blocked with "Quota can't be lower than current usage (X GiB)".
- **AC-TEN-3.3** Given a successful quota update, then the list row's storage bar updates (optimistic update with rollback on error).
- **AC-TEN-3.4** Given no `quota:update`, then quota fields are read-only text, not disabled inputs.

---

### SPEC-TEN-4 — Suspend / resume tenant [MVP]
**Implements:** US-4.1 · REQ-4

**Behaviour**
- Row menu and drawer show *Suspend* (`tenant:suspend`) for active tenants and *Resume* for suspended ones.
- Suspend opens a danger dialog explaining consequences; the user must type the tenant name to enable *Suspend tenant*.
- Calls `suspendTenant` → `202` with a task. The row shows status `provisioning` with spinner until `tenant.updated` arrives.

**Acceptance criteria**
- **AC-TEN-4.1** The confirm button is disabled until the typed text exactly matches the tenant name.
- **AC-TEN-4.2** After confirming, a task appears in the task center and the row status updates when the task succeeds.
- **AC-TEN-4.3** If the task fails, the row reverts to `active` and a toast shows the task error `title`.
- **AC-TEN-4.4** A `reseller_admin` doesn't see *Suspend* enabled (disabled with tooltip).

---

### SPEC-CMP-1 — VM list with realtime status (Vue remote) [MVP]
**Implements:** US-5.1 · REQ-5

**Behaviour**
- Table: Name, Status (badge with icon + text, never colour alone), vCPU, Memory, IP, Actions.
- Data from `listVms`; live updates from `vm.updated` events (WS-3).
- Transitional statuses (`starting`, `stopping`, `rebooting`) show a spinner and the linked task's progress %.

**Acceptance criteria**
- **AC-CMP-1.1** Given a `vm.updated` event changes VM status to `stopped`, then the row updates within one animation frame of the event being processed, with no network request.
- **AC-CMP-1.2** Given 50 events arrive within 100 ms, then the component re-renders at most once per animation frame (batched).
- **AC-CMP-1.3** Given the WS connection drops and reconnects, then the VM list is refetched once (WS-2).
- **AC-CMP-1.4** Status changes are announced politely to screen readers via an `aria-live="polite"` region ("web-01 is now stopped"), at most one announcement per second.

---

### SPEC-CMP-2 — VM actions as long-running tasks [MVP]
**Implements:** US-6.1 · REQ-6

**Behaviour**
- Actions per status: `stopped` → Start; `running` → Stop, Reboot; transitional → all disabled.
- *Stop* asks for confirmation. Start and Reboot do not.
- Action → `runVmAction` → `202 Task` → button area shows progress until task ends → toast on success/failure.
- `409 VM_BUSY` → toast "web-01 is busy with another operation".

**Permissions:** `vm:operate`. Without it, action buttons are hidden (toolbar context, RBAC-4).

**Acceptance criteria**
- **AC-CMP-2.1** Given a running VM, when the user clicks *Reboot*, then the status becomes `rebooting` immediately (optimistic) and progress % updates from task events.
- **AC-CMP-2.2** Given the task fails, then status reverts to the server's latest value and a toast shows the error.
- **AC-CMP-2.3** Given `tenant_viewer`, then no action buttons are rendered.
- **AC-CMP-2.4** While a VM has an active task, all its actions are disabled with tooltip "Operation in progress".

---

### SPEC-TSK-1 — Task center [MVP]
**Implements:** US-7.1 · REQ-7

**Behaviour**
- Header button opens a panel listing tasks: running first (with progress bar), then recent (last 24 h), each with resource name, kind, status, time.
- Live updates from `task.updated`. Clicking a task navigates to its resource.
- Owned by the shell; remotes publish `task.started` on the EventBus so it appears instantly.

**Acceptance criteria**
- **AC-TSK-1.1** A task started in the Compute remote appears in the shell's task center within 100 ms (EventBus), before the first WS event.
- **AC-TSK-1.2** Progress bars use `role="progressbar"` with `aria-valuenow`.
- **AC-TSK-1.3** Failed tasks show the error `title` and a *View resource* link.

---

### SPEC-STO-1 — Bucket list and usage [MVP]
**Implements:** US-8.2 · REQ-8

**Behaviour:** Usage card on top (used / quota, % bar, warning at ≥ 80%, danger at ≥ 95%). Table: Name, Size, Objects, Versioning, Created, actions (Delete).

**Acceptance criteria**
- **AC-STO-1.1** Usage at 85% shows a warning style and text "85% of quota used" (not colour alone).
- **AC-STO-1.2** Sizes are formatted in binary units (KiB, MiB, GiB) with one decimal place.
- **AC-STO-1.3** Empty state offers *Create bucket* only with `bucket:create`.

---

### SPEC-STO-2 — Create and delete bucket [MVP]
**Implements:** US-8.1

**Behaviour**
- Create dialog: Name (S3 naming rules: 3–63 chars, lowercase, digits, dots, hyphens; no `..`; not IP-formatted), Versioning toggle.
- Delete requires typing the bucket name; only empty buckets can be deleted (`409 BUCKET_NOT_EMPTY` otherwise).

**Acceptance criteria**
- **AC-STO-2.1** Name "My_Bucket" shows a field error before submit.
- **AC-STO-2.2** Name "192.168.1.1" is rejected ("Bucket names can't look like IP addresses").
- **AC-STO-2.3** Creating a bucket when quota is fully used shows the API's `QUOTA_EXCEEDED` error in the dialog.
- **AC-STO-2.4** Deleting a non-empty bucket shows "Empty the bucket before deleting it".

---

### SPEC-SHL-5 — Real-user monitoring [MVP]
**Implements:** US-11.1 · REQ-11

**Behaviour:** Shell registers `onLCP`, `onINP`, `onCLS` from `web-vitals` and posts them (batched, `navigator.sendBeacon`) to `/rum` with route and remote name. A small internal page `/_vitals` shows p75 per route.

**Acceptance criteria**
- **AC-SHL-5.1** Metrics are sent once per page lifecycle, on `visibilitychange: hidden`.
- **AC-SHL-5.2** Each record includes `metric`, `value`, `rating`, `route`, `remote`, `navigationType`.
- **AC-SHL-5.3** `/_vitals` shows p75 values with good / needs-improvement / poor ratings.

---

### SPEC-PLN-1 — Plans list [Stretch]
Read-only cards of plans with price per GiB and per vCPU. Requires `plan:read`.

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
- **NFR-PERF-1** Bundle budgets (gzip), enforced by `size-limit` in CI:

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

### Accessibility
- **NFR-A11Y-1** WCAG 2.2 AA. `@axe-core/playwright` runs on every e2e page; any serious/critical violation fails CI.
- **NFR-A11Y-2** Every interactive element is keyboard-operable with a visible focus ring.
- **NFR-A11Y-3** Status is never conveyed by colour alone.
- **NFR-A11Y-4** Dialogs and drawers trap focus and restore it on close.

### Security
- **NFR-SEC-1** CSP in production: `default-src 'self'; script-src 'self' <remote origins>; connect-src 'self' <api> <ws>; object-src 'none'; frame-ancestors 'none'; base-uri 'self'`. Remote origins come from a manifest, not wildcards.
- **NFR-SEC-2** No `dangerouslySetInnerHTML` / `v-html` (lint error unless allowlisted with a sanitiser and an ADR).
- **NFR-SEC-3** Session token kept in memory only; never in `localStorage`. (Demo trade-off: refresh signs out. Documented in ADR-0005.)
- **NFR-SEC-4** All server-provided strings are rendered as text. URLs from the API are validated against an allowlist of schemes (`https:`).
- **NFR-SEC-5** Dependencies scanned in CI (`pnpm audit --prod`, fail on high).

### Reliability
- **NFR-REL-1** Each remote has an error boundary (SPEC-SHL-4).
- **NFR-REL-2** All queries have sensible `staleTime` and retry policies: retry 2× on network/5xx, never on 4xx.

### Code quality
- **NFR-CODE-1** TypeScript `strict: true`, `noUncheckedIndexedAccess: true`. No `any` without a `// reason:` comment (lint rule).
- **NFR-I18N-1** User-facing strings live in per-remote message files; no inline literals in JSX/templates (lint warning).

---

## 10. Testing strategy

| Layer | Tool | Covers | Runs |
|---|---|---|---|
| Static | `tsc`, ESLint + custom rules | types, conventions, contract usage | pre-commit, agent hook, CI |
| Unit | Vitest | pure logic: formatters, permission helpers, WS batching, URL state | pre-commit (affected), CI |
| Component | Vitest + Testing Library + MSW | component behaviour with mocked API | CI |
| Interaction | Storybook `play` functions (test-runner / Vitest addon) | design-system behaviour in all states | CI |
| Contract | Zod validation of MSW + mock-api responses | mock API matches contract | CI |
| E2E | Playwright against shell + remotes + mock-api | user journeys, RBAC, remote isolation, a11y (axe) | CI on every PR |
| Perf | Playwright trace + `size-limit` | long tasks during scroll, bundle budgets | CI |

### Rules
- **TEST-1** Test names start with the AC or BUG ID they cover.
- **TEST-2** Every bug fix PR includes a test that fails before the fix (CI runs the new test against `main` to prove it fails — stretch).
- **TEST-3** No `waitForTimeout` / fixed sleeps in Playwright; use web-first assertions (`expect(locator).toHaveText`). Lint rule enforces this.
- **TEST-4** Flaky tests are not retried into green: CI runs with `retries: 0` on PRs; a flake gets a `BUG-*` issue and a fix, not a skip.
- **TEST-5** Selectors use roles and accessible names (`getByRole`), not CSS classes or test IDs, unless no accessible name exists.
- **TEST-6** E2E uses deterministic mock data (`MOCK_SEED`, `MOCK_FAILURE_RATE=0`) except in tests for failure paths.

### Required e2e journeys

| ID | Journey | Covers |
|---|---|---|
| E2E-1 | Provider admin searches, sorts, opens tenant, edits quota | AC-TEN-1.2/1.3, AC-TEN-3.1/3.3 |
| E2E-2 | Provider admin creates tenant incl. 409 path | AC-TEN-2.1–2.5 |
| E2E-3 | Provider admin suspends tenant, sees task complete | AC-TEN-4.1/4.2 |
| E2E-4 | Tenant admin reboots VM and sees live progress | AC-CMP-2.1, AC-TSK-1.1 |
| E2E-5 | Tenant viewer sees no actions; direct URL to /tenants shows 403 | AC-CMP-2.3, AC-SHL-3.1 |
| E2E-6 | Storage remote down; tenants and compute still work | AC-SHL-4.1/4.2/4.4 |
| E2E-7 | Tenant admin creates bucket, hits validation, deletes it | AC-STO-2.* |
| E2E-8 | Reseller sees only own tenants | AC-TEN-1.5 |

---

## 11. Agent harness

The harness is what makes agent output trustworthy. It is part of the product and is reviewed like code.

### 11.1 `AGENTS.md` (repo root) — required content
```md
# Nimbus Console — Agent guide

## Before you change anything
1. Find the SPEC-* / AC-* IDs for your task in specs/features/. If none exist, STOP and ask for a spec.
2. Read the relevant contract operations in contracts/openapi.yaml (or call the `spec-kb` MCP tool).
3. Read the package-level AGENTS.md in the folder you're editing.

## Hard rules
- Never edit libs/api-client/src/generated/**. Change contracts/main.tsp, then run `pnpm contract:build && pnpm api:generate`.
- Never call fetch/axios directly. Use generated hooks from @nimbus/api-client.
- Never check role names. Use can()/<Can>/v-can with Permission enum values.
- Never weaken or delete an existing assertion to make a test pass. If a test is wrong, say so and explain.
- Every AC you implement needs a test whose name starts with the AC ID.
- Handle all states: loading, empty, error, no-permission.
- No dangerouslySetInnerHTML / v-html. No localStorage for tokens.

## Commands
pnpm nx affected -t lint typecheck test   # fast check
pnpm e2e --grep "<AC-ID>"                  # run related e2e
pnpm trace                                  # AC → test coverage
pnpm storybook                              # component workshop

## Definition of done
See SPEC.md §16. Report which AC IDs you implemented and which tests cover them.
```
Each app/lib also has a short local `AGENTS.md` (e.g. `apps/compute/AGENTS.md`: "This is Vue 3. Use Composition API + `<script setup lang="ts">`. Use `useQuery` from `@tanstack/vue-query` via generated hooks.").

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
| `nimbus/test-name-has-id` | test titles without an `AC-`/`BUG-` prefix in `apps/**` |
| `nimbus/no-cross-remote-import` | importing one remote from another (MF-3) |

---

## 12. CI/CD pipeline

`.github/workflows/ci.yml` — runs on every PR:

```
1. install (pnpm, cached)                    
2. contract:check   — openapi.yaml & generated client up to date (git diff --exit-code)
3. trace:check      — PR "Implements:" not empty; every AC has ≥1 test
4. nx affected -t lint typecheck test        (parallel)
5. storybook:test   — interaction tests for affected libs
6. build            — all apps
7. size-limit       — bundle budgets (NFR-PERF-1)
8. e2e              — start mock-api + preview servers, run Playwright (+ axe), upload traces on failure
9. report           — post comment: coverage of ACs, bundle size diff, failed traces
```

Main branch: same + deploy preview (stretch: GitHub Pages for shell/remotes, mock-api on a free host) and Storybook publish.

---

## 13. Architecture Decision Records

Write each as `docs/adr/ADR-000x-title.md` with **Context · Options · Decision · Consequences**.

| ADR | Decision |
|---|---|
| ADR-0001 | Module Federation (Vite plugin) over iframes and over build-time packages, for independent deploys with shared dependencies |
| ADR-0002 | Framework-agnostic `mount(el, ctx)` remote contract so Vue and React remotes coexist (path for migrating a Vue monolith) |
| ADR-0003 | TypeSpec as contract source of truth, compiled to OpenAPI; clients, Zod and MSW generated by Orval |
| ADR-0004 | TanStack Query for server state; WS events write into the query cache rather than a separate store |
| ADR-0005 | In-memory session token for the demo; trade-offs vs httpOnly cookies |
| ADR-0006 | Permission-based (not role-based) UI checks; UI is never the security boundary |
| ADR-0007 | Test pyramid and zero-retry policy for PRs |

---

## 14. Build plan & milestones

Target: 7 working days to a demo-ready state. Each day ends with green CI.

| Day | Milestone | Done when |
|---|---|---|
| 1 | **Foundation** — Nx + pnpm workspace, shell + 3 empty remotes loading via MF, design tokens, CI skeleton, AGENTS.md, hooks HOOK-1/2 | Shell navigates to 3 remotes (one Vue) in dev and preview builds |
| 2 | **Contract** — TypeSpec, openapi.yaml, Orval generation (React + Vue hooks, Zod, MSW), mock-api with seed data + `/login` + `/me` | `contract:check` in CI; `getMe` typed end to end |
| 3 | **Shell & RBAC** — SPEC-SHL-1/2/3, `<Can>`/`v-can`, 403 page, ui-kit basics in Storybook | E2E-5 passes |
| 4 | **Tenants** — SPEC-TEN-1 (virtualised table, URL state), SPEC-TEN-3 drawer | E2E-1, E2E-8 pass; perf test for AC-TEN-1.1 |
| 5 | **Tasks & Compute** — WS server + client (WS-1…4), SPEC-TSK-1, SPEC-CMP-1/2 in Vue | E2E-4 passes |
| 6 | **Wizard, suspend, storage** — SPEC-TEN-2, SPEC-TEN-4, SPEC-STO-1/2, SPEC-SHL-4 isolation | E2E-2, 3, 6, 7 pass |
| 7 | **Harness & polish** — skills, subagents, MCP spec server, 2 eval fixtures, 3 custom lint rules, size-limit, RUM page, ADRs, README | Full CI green; demo script rehearsed |

If time is short, cut in this order: SPEC-SHL-5 `/_vitals` page → eval fixtures (keep 1) → SPEC-TEN-3 quota editing → Storage delete flow. Never cut: contract generation, RBAC, WS + tasks, e2e in CI, AGENTS.md + hooks.

---

## 15. Interview demo script (≈ 8 minutes)

1. **Spec → code trace (1 min).** Open `specs/features/SPEC-TEN-2.md`, show an AC, run `pnpm trace` and jump to the test named `AC-TEN-2.4`.
2. **Contract-first (1 min).** Add a field in `main.tsp`, regenerate, show the TypeScript error appear in the tenant table until it's handled.
3. **App tour (2 min).** Sign in as provider admin → scroll 10k tenants → create tenant (show the 409 path) → sign in as tenant admin → reboot a VM in the **Vue** remote and watch progress in the **React** shell's task center.
4. **Resilience (30 s).** Restart mock-api with `MOCK_FAIL_REMOTE=storage`; Storage shows an error panel, everything else works.
5. **Harness (2 min).** Ask the agent to "add a Region column to tenants". Show: it queries the MCP spec server, HOOK-2 blocks it from editing generated code, the lint rule catches a raw `fetch`, and the hook feeds the error back so it fixes itself.
6. **Quality gates (1 min).** Open a PR: CI shows AC coverage, bundle size diff, Playwright traces and axe results.
7. **What I'd do next (30 s).** Point to the ADRs and the "Where the agent failed" section of the README.

---

## 16. Definition of Done

A feature is done when:

- [ ] Spec has IDs; `spec-reviewer` found no open issues.
- [ ] Contract updated first; generated code untouched by hand; `contract:check` passes.
- [ ] All ACs implemented; each has ≥ 1 test named with its ID; `pnpm trace` green.
- [ ] Loading, empty, error and no-permission states exist and have stories.
- [ ] Keyboard and screen-reader checks pass; axe shows no serious/critical issues.
- [ ] Bundle budgets respected.
- [ ] No new lint suppressions without a `reason:` comment.
- [ ] PR description lists **Implements:** IDs and notes any agent mistakes caught (feeds the review → lint loop).
- [ ] CI green with zero retries.