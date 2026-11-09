# ADR-0006 — Permission-based UI checks; the UI is never the security boundary

- **Status:** Accepted
- **Date:** 2026-11-06 (Day 9). Scheduled for Day 3 (D1-12), when the checks were first built; written late (D9-12) and describes what has been in place since then.
- **Deciders:** Rasul Idiev
- **Related:** `specs/shared/rbac.md` (RBAC-1…6), AGENTS.md H3, `libs/auth`, `contracts/main.tsp` (`Permission`, `x-permission`), ADR-0005, D9-04, `docs/review-rules.md`

## Context

Four roles (provider_admin, reseller_admin, tenant_admin, tenant_viewer) use one console. Each area, button and page has to decide what a user may see and do. Most of the code is written by agents, which reach for the obvious `if (role === 'provider_admin')`. Role checks spread the RBAC matrix through every component: a new role or a changed permission means finding every comparison, and the UI and the API drift apart.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **A. The UI checks permissions from `Me.permissions`, with the generated `Permission` enum; the API enforces every permission and scope** | One matrix (the server's), the UI follows it; new roles need no UI change; typos are type errors | The UI can't express "own vs all" scope (the API does) |
| B. The UI checks role names | Simple to read at first | The matrix is copied into components; drifts from the API; every role change touches the UI |
| C. The UI enforces access (hides data the API would return) | — | A hidden button isn't security; any client can call the API |

## Decision

**Option A.**

- **The server is the boundary.** Every operation declares `x-permission` in the contract; mock-api checks it and the scope (all / own) on every call (RBAC-2). A 403 is always possible and always handled (AC-SHL-3.2).
- **The UI only reflects permissions.** `can(session, Permission['x:y'])` from `libs/auth`, `<Can>` in React, `v-can` in Vue, over the frozen `SessionSnapshot.permissions` from `GET /me` (RBAC-1). Areas without their read permission aren't in the sidebar (RBAC-3) and show the 403 page when opened directly (RBAC-5). Actions are hidden or disabled with `rbac.disabledTooltip` (RBAC-4).
- **No role names, no permission strings.** Permissions come from the generated `Permission` enum (RBAC-6). Both are lint errors since Day 9: `nimbus/no-role-check`, `nimbus/no-raw-permission` (TECH-10, `docs/review-rules.md`). `libs/auth` is the only place allowed to know roles (the RBAC library itself).
- **"Admin" means "no own tenant".** Areas that differ for provider/reseller admins branch on `session.tenant === null` (the tenant picker, SPEC-CMP-4, SPEC-STO-3), not on a role.
- **New capabilities get a permission, not a role check.** Example: `/_vitals` is provider-only through a new `vitals:read` permission (D9-04), added to the contract, the matrix and the mock, with no UI role logic.

## Consequences

- Changing who may do what is a contract and mock-api change; the UI follows without edits.
- The UI can't show scope ("own" tenants only). Lists rely on the server's scoping, and tests assert it end to end (AC-TEN-1.5, AC-STO-3.3).
- Tests build sessions from permission lists (`testSession([...])`), so a component test covers a permission set, not a role.
