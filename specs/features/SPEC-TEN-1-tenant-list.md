---
id: SPEC-TEN-1
title: "Tenant list"
area: tenants
day: 5
implements: [US-2.1, US-2.2, US-2.3]
---

# SPEC-TEN-1 — Tenant list [MVP]

Shared rules: [mf-contract](../shared/mf-contract.md) · [realtime](../shared/realtime.md) · [rbac](../shared/rbac.md) · [url-conventions](../shared/url-conventions.md) · [messages-and-format](../shared/messages-and-format.md)

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

| ID | Criterion | Status |
|---|---|---|
| **AC-TEN-1.1** | Given 10,000 tenants, when the user scrolls to the bottom repeatedly, then at most 60 table row elements (`[role="row"]` in the body) exist in the DOM at any time (blocking e2e suite). Scrolling smoothness is a target, NFR-PERF-5, not an AC. | `planned` |
| **AC-TEN-1.2** | When the user types "acme" in search, then exactly one request is sent 300 ms after the last keystroke, and the URL contains `?q=acme`. | `planned` |
| **AC-TEN-1.3** | When the user clicks the *Name* header, then sort toggles asc → desc, the header has the correct `aria-sort`, and the request uses `sort=name` / `sort=-name`. | `planned` |
| **AC-TEN-1.4** | Given URL `/tenants?status=suspended&sort=-createdAt`, when the page loads, then filters and sort controls reflect the URL. | `planned` |
| **AC-TEN-1.5** | Given a `reseller_admin`, then only their tenants appear (verified in e2e against mock API scoping). | `planned` |
| **AC-TEN-1.6** | Given a `tenant.updated` WS event, then that row's status badge updates without refetching the list. | `planned` |
| **AC-TEN-1.7** | Table is keyboard navigable: Tab into the grid, arrow keys move between rows, Enter opens the detail drawer. | `planned` |
