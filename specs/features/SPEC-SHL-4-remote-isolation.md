---
id: SPEC-SHL-4
title: "Remote isolation"
area: shell
day: 7
implements: [US-10.1]
---

# SPEC-SHL-4 — Remote isolation [MVP]

Shared rules: [mf-contract](../shared/mf-contract.md) · [realtime](../shared/realtime.md) · [rbac](../shared/rbac.md) · [url-conventions](../shared/url-conventions.md) · [messages-and-format](../shared/messages-and-format.md)

**Implements:** US-10.1 · MF-4 · MF-6

**Behaviour**
- Error boundaries live inside each remote (MF-6). A fatal `remote:error` makes the shell unmount that remote, dispose its scope and show the MF-4 panel. The shell's own boundary covers load failures and a `mount()` that throws.
- Remotes receive context changes through `update(ctx)`, including `ctx.path` ([mf-contract](../shared/mf-contract.md)).
- Simulating failures: e2e intercepts `**/remotes/storage/**` with `page.route` (503) and restores it with `page.unroute`; the live demo uses the gateway's `FAIL_REMOTES` / `POST /__test/fail-remotes`; each remote has a `/__crash` route, present only in `development` and `e2e` builds (SPEC.md §2.2), that throws during render (`specs/mock-data.md` SPEC.md §8).

**Acceptance criteria**

| ID | Criterion | Status |
|---|---|---|
| **AC-SHL-4.1** | Given the storage remote fails to load, when the user opens `/storage`, then an error panel `shell.remoteUnavailable` "Storage is temporarily unavailable." with *Retry* is shown, and the sidebar and header stay usable. | `done` |
| **AC-SHL-4.2** | Given the storage remote fails, then `/tenants` and `/compute` each show their heading and at least one data row. | `done` |
| **AC-SHL-4.3** | A render error in any remote (React or Vue) results in the MF-4 panel for that remote and one logger entry naming it. | `done` |
| **AC-SHL-4.4** | When the remote is back (e2e: `page.unroute`) and the user clicks *Retry*, then it loads without a full page refresh. | `done` |
| **AC-SHL-4.5** | After the shell calls `update` with a session that no longer has `vm:operate`, compute's action buttons disappear without a remount (component test: `mountRemote` from `libs/test-utils` mounts compute, then calls `update()` with a `SessionSnapshot` without `vm:operate`). | `done` |
| **AC-SHL-4.6** | Browser back/forward between `/compute` and `/compute/vm_01` (SPEC-CMP-5) updates the compute view through `ctx.path`. | `done` |
