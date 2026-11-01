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
- Server-side search (`q`, debounced 300 ms; case-insensitive substring of name or display name, D5-05), filters (status, plan; single-select, URL `status` / `planId`), sort (name, created, storage used). Each column has two states, never "unsorted": the first click uses its natural direction (*Name* ascending; *Created* and *Storage used* descending), every further click flips it; `sort=name` is the default and is left out of the URL (D5-01). Invalid URL values are dropped with a replace (D5-06).
- Infinite scroll using cursor pagination (`limit=100`), rows virtualised (TanStack Virtual). Header shows `tenants.list.count` "Showing {shown} of {total} tenants".
- Filter, sort and search state live in the URL query string (shareable links, back button works).
- Row click opens tenant detail drawer (SPEC-TEN-3).
- A live `tenant.updated` updates the row in place, even if it no longer matches the status filter; count and membership are corrected at the next refetch (D5-02).
- Row menu: *Open details*, *View VMs* (`/compute?tenantId=<id>`), *View buckets* (`/storage?tenantId=<id>`). *Suspend*/*Resume* join it with SPEC-TEN-4 (D5-03).

**States**

| State | UI |
|---|---|
| Initial loading | Skeleton rows (10) |
| Empty (no tenants) | Illustration + `tenants.empty` "No tenants yet" + *Create tenant* (if `tenant:create`) |
| No results for filters | `tenants.noMatches` "No tenants match your filters" + *Clear filters* |
| Error | Inline error with the mapped message for `Problem.code` (MSG-3), *Retry* |
| Fetching next page | Spinner row at bottom |
| Background refetch | Subtle progress bar in table header; rows remain |

**Permissions:** requires `tenant:read`. *Create tenant* button requires `tenant:create` (hidden otherwise; rendered from SPEC-TEN-2, D5-16). Row menu *Suspend* requires `tenant:suspend` (disabled with tooltip otherwise, RBAC-4).

**API:** `listTenants`. Reseller scoping is server-side.

**Acceptance criteria**

| ID | Criterion | Status |
|---|---|---|
| **AC-TEN-1.1** | Given 10,000 tenants, when the user scrolls to the bottom repeatedly, then at most 60 table row elements (`[role="row"]` in the body) exist in the DOM at any time (blocking e2e suite). Scrolling smoothness is a target, NFR-PERF-5, not an AC. | `in-progress` |
| **AC-TEN-1.2** | When the user types "acme" in search, then exactly one request is sent 300 ms after the last keystroke, and the URL contains `?q=acme`. | `in-progress` |
| **AC-TEN-1.3** | When the user clicks the *Name* header, then sort toggles asc → desc, the header has the correct `aria-sort`, and the request uses `sort=name` / `sort=-name`. | `in-progress` |
| **AC-TEN-1.4** | Given URL `/tenants?status=suspended&sort=-createdAt`, when the page loads, then filters and sort controls reflect the URL. | `in-progress` |
| **AC-TEN-1.5** | Given a `reseller_admin`, then only their tenants appear (verified in e2e against mock API scoping). | `in-progress` |
| **AC-TEN-1.6** | Given a `tenant.updated` WS event, then that row's status badge updates without refetching the list. | `in-progress` |
| **AC-TEN-1.7** | Table is keyboard navigable: Tab into the grid, arrow keys move between rows, Enter opens the detail drawer. | `in-progress` |
