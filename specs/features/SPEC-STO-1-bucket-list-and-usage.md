---
id: SPEC-STO-1
title: "Bucket list and usage"
area: storage
day: 8
implements: [US-8.2]
---

# SPEC-STO-1 — Bucket list and usage [MVP]

Shared rules: [mf-contract](../shared/mf-contract.md) · [realtime](../shared/realtime.md) · [rbac](../shared/rbac.md) · [url-conventions](../shared/url-conventions.md) · [messages-and-format](../shared/messages-and-format.md)

**Implements:** US-8.2 · REQ-8

**Behaviour:** Usage card on top (used / quota, % bar, warning at ≥ 80%, danger at ≥ 95%; thresholds use the exact ratio, the displayed percent is floored, SPEC.md §9). Table: Name, Size, Objects, Versioning, Created, actions (Delete). Usage card and list update from `server:quota.updated` and `server:bucket.updated` (RT-4).

**Acceptance criteria**

| ID | Criterion | Status |
|---|---|---|
| **AC-STO-1.1** | Usage at 85% shows a warning style and text `storage.usagePercent` "85% of quota used" (not colour alone). | `done` |
| **AC-STO-1.2** | Sizes are formatted with `formatBytes` from `libs/format` (SPEC.md §9): binary units, one decimal place, trailing `.0` dropped, e.g. "100 GiB", "1.5 GiB", "0 B". | `done` |
| **AC-STO-1.3** | Empty state offers *Create bucket* only with `bucket:create`. | `done` |
| **AC-STO-1.4** | Creating or deleting a bucket updates the usage card and the bucket list from events. | `done` |
