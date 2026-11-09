---
id: SPEC-TEN-2
title: "Create tenant wizard"
area: tenants
day: 7
implements: [US-3.1]
---

# SPEC-TEN-2 — Create tenant wizard [MVP]

Shared rules: [mf-contract](../shared/mf-contract.md) · [realtime](../shared/realtime.md) · [rbac](../shared/rbac.md) · [url-conventions](../shared/url-conventions.md) · [messages-and-format](../shared/messages-and-format.md)

**Implements:** US-3.1 · REQ-3

**Behaviour**
Modal wizard with 3 steps and a step indicator:

1. **Details** — Name (slug rules from contract), Display name, Admin email.
2. **Plan & quotas** — Plan (radio cards from `listPlans`, stretch: hard-coded if plans not built), Storage quota (whole GiB input, min 1, converted to bytes by `libs/format`), VM quota (1–500). Plan sets defaults; quotas cannot exceed the plan's max.
3. **Review** — Summary of all values with *Edit* links to each step; *Create tenant*.

- Validation uses generated Zod schemas, extended with UI rules (plan max).
- *Next* validates the current step only. *Back* keeps values.
- Closing a dirty wizard asks `tenants.discardChanges` "Discard changes?".
- On submit: `createTenant` → `201 TenantCreated { tenant, task }` → close, publish `task:started` with `task` ([realtime](../shared/realtime.md)), toast `tenants.toast.created` "Tenant {name} created.", new tenant appears at the top of every cached list whose filters it matches, whatever the sort, and moves to its sorted place on the next refetch (cache insert, no full refetch, D7-04).
- `409 TENANT_NAME_TAKEN` → go back to step 1 with field error on Name.
- `422` → map `errors[].field` to form fields.

**Permissions:** `tenant:create`.

**Acceptance criteria**

| ID | Criterion | Status |
|---|---|---|
| **AC-TEN-2.1** | Given an invalid name "Acme Corp", when the user clicks *Next*, then step 1 stays open and Name shows `tenants.nameInvalid` "Use lowercase letters, numbers and hyphens." | `done` |
| **AC-TEN-2.2** | Given plan "Starter" (max 100 GiB), when the user enters 200 GiB, then *Next* is blocked with `errors.QUOTA_EXCEEDS_PLAN.storage` "Starter allows up to 100 GiB." | `done` |
| **AC-TEN-2.3** | Given valid inputs, when the user reaches Review, then all values are shown and each *Edit* link returns to the right step with values kept. | `done` |
| **AC-TEN-2.4** | Given the API returns 409, then the wizard returns to step 1 and Name shows `errors.TENANT_NAME_TAKEN` "This name is already taken." | `done` |
| **AC-TEN-2.5** | When the user submits twice quickly, then only one request is sent (button disabled while pending). | `done` |
| **AC-TEN-2.6** | Focus moves to the step heading on each step change; Escape triggers the discard prompt if dirty; focus returns to *Create tenant* button on close. | `done` |
| **AC-TEN-2.7** | The provisioning task of a new tenant appears in the task center immediately after creation. | `done` |
| **AC-TEN-2.8** | Given plan "Starter" (max 10 VMs), when the user enters 20, then *Next* is blocked with `errors.QUOTA_EXCEEDS_PLAN.vms` "Starter allows up to 10 VMs." | `done` |
