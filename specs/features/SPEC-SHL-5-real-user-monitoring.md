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

**Behaviour:** Shell registers `onLCP`, `onINP`, `onCLS` from `web-vitals` and posts them (batched, `navigator.sendBeacon`) to `/api/rum` with route and remote name. A small internal page `/_vitals` shows p75 per route.

**Acceptance criteria**

| ID | Criterion | Status |
|---|---|---|
| **AC-SHL-5.1** | Each metric is sent at most once per page load, flushed on `visibilitychange: hidden` or `pagehide`. (E2E triggers the flush with `page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))` after stubbing `document.visibilityState`.) | `planned` |
| **AC-SHL-5.2** | Each record includes `metric`, `value`, `rating`, `route`, `remote`, `navigationType`. | `planned` |
| **AC-SHL-5.3** | `/_vitals` shows p75 values over the last 24 h of records, rated good / needs-improvement / poor with web-vitals' standard thresholds (tested with records seeded via `reportVitals`). | `planned` |
