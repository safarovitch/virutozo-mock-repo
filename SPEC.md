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

Moved to [`specs/shared/mf-contract.md`](specs/shared/mf-contract.md): `RemoteContext`, `RemoteModule`, `SessionSnapshot` and MF-1…MF-6.

### 2.5 Realtime and the EventBus

Moved to [`specs/shared/realtime.md`](specs/shared/realtime.md): one WebSocket owned by the shell, RT-1…RT-12, the EventBus catalogue, task merging and the Vue example.

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

Every AC has exactly one status, in the Status column of its spec's AC table. Since the split (first commit of TECH-1, Day 1), ACs and their statuses live **only** in `specs/features/SPEC-*.md`, §7 is an index with links, and `trace:check` parses `specs/features/` and `specs/shared/` and fails if an ID is defined in more than one file. The split is the **first commit of TECH-1**:
- **Feature specs:** one file each, flat, named `specs/features/SPEC-<AREA>-<n>-<slug>.md` (e.g. `SPEC-TEN-2-create-tenant-wizard.md`). Front matter: `id`, `title`, `area`, `day`, `implements` (US IDs). Then the sections, and an **AC table with a Status column** (`| ID | Criterion | Status |`).
- **Shared blocks:** `specs/shared/<topic>.md`, one file per topic: `url-conventions.md` (drawer URLs, `tenantId`, history rules), `rbac.md` (matrix, RBAC-1…6), `realtime.md` (RT and WS rules, bus catalogue), `messages-and-format.md` (MSG-1…4, the `libs/format` functions), `mf-contract.md` (MF rules, `RemoteContext`, `SessionSnapshot`). Feature specs link to shared files and never copy from them. Rule IDs live only in shared files.
- **SPEC.md keeps** the overview, architecture summary, NFRs, testing strategy, build plan, demo script, Definition of Done, and an index linking every feature and shared file. It also keeps the sections D1-03 doesn't move (traceability, requirements, API contract index, design system, harness, CI, ADRs); their rule IDs (NFR, TEST, HOOK, API, T1–T6) stay defined in SPEC.md, which `trace:check` scans too. Moved sections keep a one-line stub under their old heading so references like "SPEC.md §2.5" still lead to the right file.

Until the split exists, until `specs/features/` exists, `trace:check` runs only T1 and prints a warning. Example lines use the placeholder `AC-XXX-n.m` inside code blocks, and the parser ignores code blocks:

```md
| ID | Criterion | Status |
|---|---|---|
| **AC-XXX-n.m** | Given …, when …, then … | `planned` |
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

Moved to [`specs/shared/rbac.md`](specs/shared/rbac.md): permission strings, the role matrix and RBAC-1…RBAC-6.

---

## 6. API contract

### 6.1 Principles
- **API-1** Contract-first: change `contracts/main.tsp` → `pnpm contract:build` → `pnpm api:generate`. CI fails if `openapi.yaml` or generated code is out of date.
- **API-2** All errors use RFC 9457 `application/problem+json`: `{ type, title, status, detail, code, params?, errors? }`. The UI shows only the message for `code`, filled from `params` (MSG-3). Every operation can return `CommonErrors`: 422 `VALIDATION_FAILED`, 429 `RATE_LIMITED`, 500 `INTERNAL`; `reportVitals` also returns 413 (D2-02).
- **API-3** Lists use cursor pagination: `?limit=50&cursor=…` → `{ items, nextCursor, total }`.
- **API-4** Long operations return `202 Accepted` with a `Task`; progress arrives over WebSocket and via `GET /tasks/{id}`.
- **API-5** All responses are validated at runtime with generated Zod schemas in dev and test; in production validation failures are logged, not thrown.
- **API-6** Breaking contract changes require an ADR.

### 6.2 Resources

The complete contract is **`contracts/main.tsp`** (source of truth) and the compiled **`contracts/openapi.yaml`**. This table is an index only; if it ever disagrees with the contract, the contract wins. Each operation carries its required permission as `x-permission`. All paths are under **`/api`** (gateway and dev proxy, ADR-0005). Every POST/PUT/PATCH/DELETE to an authenticated endpoint requires `X-Nimbus-Csrf: 1` and a same-origin `Origin`, else 403. The only exemption is `reportVitals` (NFR-SEC-6). The header isn't modelled per operation: `customFetch` adds it centrally, so generated functions don't take it as an argument (D2-01).

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

Moved to [`specs/shared/realtime.md`](specs/shared/realtime.md): the `ServerEvent` union and WS-1…WS-7.

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

Feature specs live in `specs/features/`, one file each (SPEC.md §3.1). Shared blocks and all MF, RT, WS, RBAC and MSG rule IDs live in `specs/shared/`. Feature specs link to shared files and never copy from them.

ACs that show text quote the message key and the expected English text (MSG-4). Keys and texts are listed in `specs/mock-data.md` §9 (error codes) and §10 (other UI messages).

### Feature specs

| Spec | Title | Area | Day | Scope |
|---|---|---|---|---|
| [SPEC-SHL-1](specs/features/SPEC-SHL-1-sign-in-and-session.md) | Sign in and session | shell | 3 | MVP |
| [SPEC-SHL-2](specs/features/SPEC-SHL-2-navigation-and-layout.md) | Navigation and layout | shell | 3 | MVP |
| [SPEC-SHL-3](specs/features/SPEC-SHL-3-permission-handling.md) | Permission handling | shell | 3 | MVP |
| [SPEC-SHL-4](specs/features/SPEC-SHL-4-remote-isolation.md) | Remote isolation | shell | 7 | MVP |
| [SPEC-TEN-1](specs/features/SPEC-TEN-1-tenant-list.md) | Tenant list | tenants | 5 | MVP |
| [SPEC-TEN-2](specs/features/SPEC-TEN-2-create-tenant-wizard.md) | Create tenant wizard | tenants | 7 | MVP |
| [SPEC-TEN-3](specs/features/SPEC-TEN-3-tenant-detail-drawer.md) | Tenant detail drawer | tenants | 5 | MVP |
| [SPEC-TEN-4](specs/features/SPEC-TEN-4-suspend-resume-tenant.md) | Suspend / resume tenant | tenants | 7 | MVP |
| [SPEC-CMP-1](specs/features/SPEC-CMP-1-vm-list-with-realtime-status.md) | VM list with realtime status (Vue remote) | compute | 6 | MVP |
| [SPEC-CMP-2](specs/features/SPEC-CMP-2-vm-actions-as-long-running-tasks.md) | VM actions as long-running tasks | compute | 6 | MVP |
| [SPEC-CMP-4](specs/features/SPEC-CMP-4-compute-for-provider-and-reseller-admins.md) | Compute for provider and reseller admins | compute | 8 | MVP |
| [SPEC-CMP-5](specs/features/SPEC-CMP-5-vm-detail.md) | VM detail (Vue remote) | compute | 6 | MVP |
| [SPEC-TSK-1](specs/features/SPEC-TSK-1-task-center.md) | Task center | tasks | 4 | MVP |
| [SPEC-STO-1](specs/features/SPEC-STO-1-bucket-list-and-usage.md) | Bucket list and usage | storage | 8 | MVP |
| [SPEC-STO-2](specs/features/SPEC-STO-2-create-and-delete-bucket.md) | Create and delete bucket | storage | 8 | MVP |
| [SPEC-STO-3](specs/features/SPEC-STO-3-storage-for-provider-and-reseller-admins.md) | Storage for provider and reseller admins | storage | 8 | MVP |
| [SPEC-SHL-5](specs/features/SPEC-SHL-5-real-user-monitoring.md) | Real-user monitoring | shell | 9 | MVP |
| [SPEC-SHL-6](specs/features/SPEC-SHL-6-realtime-connection-and-eventbus.md) | Realtime connection and EventBus | shell | 4 | MVP |
| [SPEC-SHL-7](specs/features/SPEC-SHL-7-multi-tab-session.md) | Multi-tab session | shell | 8 | MVP |
| [SPEC-SHL-8](specs/features/SPEC-SHL-8-tenant-context.md) | Tenant context | shell | 6 | MVP |
| [SPEC-SHL-9](specs/features/SPEC-SHL-9-messages.md) | Messages | shell | 3 | MVP |
| [SPEC-PLN-1](specs/features/SPEC-PLN-1-plans-list.md) | Plans list | plans | stretch | Stretch |
| [SPEC-CMP-3](specs/features/SPEC-CMP-3-create-vm-wizard.md) | Create VM wizard | compute | stretch | Stretch |

### Shared spec blocks

| File | Contents |
|---|---|
| [mf-contract](specs/shared/mf-contract.md) | MF-1…MF-6, `RemoteContext`, `SessionSnapshot` |
| [realtime](specs/shared/realtime.md) | RT-1…RT-12, WS-1…WS-7, EventBus catalogue, `mergeTask` |
| [rbac](specs/shared/rbac.md) | Permission strings, matrix, RBAC-1…RBAC-6 |
| [url-conventions](specs/shared/url-conventions.md) | Drawer URLs, `tenantId`, history rules |
| [messages-and-format](specs/shared/messages-and-format.md) | MSG-1…MSG-4, `libs/format` functions |

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
| Toast | `aria-live`; success/info auto-dismiss after 5 s, paused on hover or focus; errors stay until dismissed (D3-02) | error toast doesn't auto-dismiss |
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

Moved to [`specs/shared/messages-and-format.md`](specs/shared/messages-and-format.md): MSG-1…MSG-4 and the `libs/format` functions.

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
| E2E-10 | Two browser contexts: provider_admin suspends `acme` → tenant_admin's header shows "Suspended", banner appears, VM actions disabled; resume → reverts | SPEC-SHL-8 (tenant side Day 6; the provider suspends and resumes through the UI since Day 7, SPEC-TEN-4, A7-09); AC-CMP-4.4/4.5 (admin side, Day 8) (D6-01) |
| E2E-11 | provider_admin on `/compute`: pick `acme` → open `/compute/vm_01` drawer → reboot with tenant-named confirmation → live progress → reload keeps drawer | SPEC-CMP-4, SPEC-CMP-5 (due Day 8, D6-01) |
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
The shipped hooks are the source of truth; this table describes them. HOOK-1/2/3/5 are Claude Code hooks (`.claude/settings.json`); HOOK-4 is a git hook (`lefthook.yml`) that protects against any agent or human. Agents can't change `.claude/settings.json` or `.claude/hooks/**` (HOOK-2, AGENTS.md H15).

| ID | Hook | Trigger | Action |
|---|---|---|---|
| HOOK-1 | `post-edit-check.mjs` | After an Edit/Write in `apps\|libs\|tools/<project>/` (`.ts`, `.tsx`, `.vue`, `.js`, …) | Run `nx run-many -t typecheck lint -p <project>`; feed errors back to the agent. No-op until the workspace is installed. |
| HOOK-2 | `guard-paths.mjs` | Before Edit/Write | **Block** files outside the repo; generated files (`contracts/openapi.yaml`, `contracts/tsp-output/**`, `libs/api-client/src/generated/**`); `.env*` except `.env.example`; and the harness (`.claude/settings.json`, `.claude/hooks/**`) unless `.claude/allow-harness-change` exists. |
| HOOK-3 | `guard-tests.mjs` | Before Edit/Write to `*.test.*`, `*.spec.*`, `*.stories.*` | **Block** removing `expect()` calls, adding `.skip`/`.only`/`.todo`/`.fixme`/`xit`/`xdescribe` in code (strings and comments ignored), and adding any `toMatchSnapshot` / `toMatchInlineSnapshot`, unless `.claude/allow-test-change` exists. |
| HOOK-4 | `lefthook.yml` | Pre-commit | `nx affected -t lint typecheck test` on staged changes, plus `pnpm test:hooks` when `.claude/hooks/**` changed. |
| HOOK-5 | `guard-bash.mjs` | Before a shell command | **Block** destructive commands (AGENTS.md H12), checking only the parts that execute: heredoc bodies and quoted strings are data; `bash -c`, `sh -c`, `eval`, `$(…)` and shell-fed heredocs are checked. |

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
| 1 | Spec split into `specs/features/` (first commit) · workspace (one pnpm workspace including `contracts/`, one root lockfile), gateway, shell + 3 remotes, MF, e2e smoke against 8080 · hooks + lefthook · CI skeleton (TECH-5 starts) |
| 2 | Contract package · generated clients · shared libs (logger, messages, format) · mock-api with cookie session, CSRF, test endpoints |
| 3 | SPEC-SHL-1/2/3 (sign-in, nav, RBAC, 403) · SPEC-SHL-9 (messages wiring) · ui-kit basics + Storybook |
| 4 | Realtime: `libs/realtime`, root and scoped bus, WS client and close codes (SPEC-SHL-6) · SPEC-TSK-1 task center |
| 5 | SPEC-TEN-1 tenant list · SPEC-TEN-3 drawer · TECH-5 done (`ci/perf` against the tenant list) |
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
