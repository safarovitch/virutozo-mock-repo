---
id: SPEC-SHL-5
title: "Real-user monitoring"
area: shell
day: 9
implements: [US-11.1]
---

# SPEC-SHL-5 — Real-user monitoring [MVP]

Shared rules: [mf-contract](../shared/mf-contract.md) · [realtime](../shared/realtime.md) · [rbac](../shared/rbac.md) · [url-conventions](../shared/url-conventions.md) · [messages-and-format](../shared/messages-and-format.md)

**Implements:** US-11.1 · REQ-11

**Behaviour:** Shell registers `onLCP`, `onINP`, `onCLS` from `web-vitals` and posts them (batched, `navigator.sendBeacon`) to `/api/rum` with route and remote name. `route` is the route **template** (`/tenants/:tenantId`, `/compute/:vmId`), never the URL: no IDs and no query string (D9-04). LCP carries the route the page was loaded on; INP and CLS the route at flush (D9-07). If `sendBeacon` refuses, the generated `reportVitals` is called once with `keepalive`; failures are ignored (D9-08). A small internal page `/_vitals` shows p75 per route; it needs `vitals:read` (provider_admin only, D9-04) and isn't in the sidebar.

**Acceptance criteria**

| ID | Criterion | Status |
|---|---|---|
| **AC-SHL-5.1** | Each metric is sent at most once per page load, flushed on `visibilitychange: hidden` or `pagehide`. (E2E triggers the flush with `page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))` after stubbing `document.visibilityState`.) | `done` |
| **AC-SHL-5.2** | Each record includes `metric`, `value`, `rating`, `route`, `remote`, `navigationType`. | `done` |
| **AC-SHL-5.3** | `/_vitals` shows p75 values over the last 24 h of records, rated good / needs-improvement / poor with web-vitals' standard thresholds (tested with records seeded via `reportVitals`). | `done` |
