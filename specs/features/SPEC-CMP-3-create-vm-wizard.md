---
id: SPEC-CMP-3
title: "Create VM wizard"
area: compute
day: stretch
implements: []
---

# SPEC-CMP-3 — Create VM wizard [Stretch]

Shared rules: [mf-contract](../shared/mf-contract.md) · [realtime](../shared/realtime.md) · [rbac](../shared/rbac.md) · [url-conventions](../shared/url-conventions.md) · [messages-and-format](../shared/messages-and-format.md)

Steps: Image → Size → Network → Review. Validates against tenant VM quota; returns a `vm.create` task.
