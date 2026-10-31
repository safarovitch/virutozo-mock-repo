# Mock data & behaviour (apps/mock-api, apps/gateway)

Source of truth for seed data, demo users, plan limits and UI message wording. Implements SPEC.md §6.4.
All generation is deterministic: the seed (42 in every `NIMBUS_MODE`, overridable with `MOCK_SEED`) drives the random generator.

## 1. Demo users and session (`POST /api/login { role }`)

| Role | User | Scope | `Me.tenant` |
|---|---|---|---|
| provider_admin | Alex Provider · `alex@nimbus.test` · `u_provider` | all tenants | `null` |
| reseller_admin | Rita Reseller · `rita@northwind.test` · `u_reseller` | reseller `r_northwind` | `null` |
| tenant_admin | Tom Admin · `tom@acme.test` · `u_tadmin` | tenant `t_acme` (home `/compute`) | `{ id: t_acme, displayName: "Acme Corporation", planName: "Business", status: active }` |
| tenant_viewer | Vera Viewer · `vera@acme.test` · `u_tviewer` | tenant `t_acme` (home `/compute`) | same as tenant_admin |

- **Routes** are served under `/api` (the gateway and the shell's dev proxy pass the path through unchanged).
- **Session:** `POST /api/login` returns `Me` and sets `nimbus_session=demo.<role>.<random>; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=<ttl>`, valid 8 hours. `MOCK_SESSION_TTL_S` shortens it. `POST /api/logout` expires it and closes all of that session's sockets with 4401.
- **No CORS.** The server sends no `Access-Control-Allow-*` headers (app and API share one origin, ADR-0005).
- **CSRF:** every POST/PUT/PATCH/DELETE to an authenticated endpoint needs `X-Nimbus-Csrf: 1`, and its `Origin` must be in `APP_ORIGINS`. Otherwise 403 `FORBIDDEN`. WebSocket upgrades with a foreign `Origin` are closed with 4403.
- **`POST /api/rum`** (`reportVitals`) is the only exemption from the CSRF header (NFR-SEC-6). It's still `Origin`-checked (403), rate-limited to 60 requests per minute per client IP (429), limited to a 16 KB body (413), and schema-validated (422). The client IP comes from `X-Forwarded-For`, trusted only from `127.0.0.1` (the gateway, D2-08).
- Permissions per role come from SPEC.md §5.2; `GET /api/me` returns them. Tenant roles have no `tenant:read`.
- **Suspended tenant:** any change to a suspended tenant's VMs, buckets or quotas returns 409 `TENANT_SUSPENDED`, whoever calls (including provider_admin; resume the tenant first). `TENANT_NOT_ACTIVE` is only for `suspendTenant` on a non-active tenant.
- **Scoping for provider/reseller:** `listVms` / `listBuckets` without `tenantId` → 422 `VALIDATION_FAILED`; a `tenantId` outside the caller's scope → 404 `NOT_FOUND`.

## 2. Plans

| id | name | maxStorageQuota | maxVmQuota | default storage / VMs | per GiB-month | per vCPU-month |
|---|---|---|---|---|---|---|
| `p_starter` | Starter | 100 GiB | 10 | 50 GiB / 5 | €0.04 (40,000) | €6.00 (6,000,000) |
| `p_business` | Business | 1 TiB | 50 | 250 GiB / 20 | €0.035 (35,000) | €5.50 (5,500,000) |
| `p_enterprise` | Enterprise | 10 TiB | 200 | 2 TiB / 100 | €0.03 (30,000) | €5.00 (5,000,000) |
| `p_unlimited` | Unlimited | 100 TiB | 500 | 10 TiB / 250 | €0.025 (25,000) | €4.50 (4,500,000) |

Prices are `Money { amountMicros, currency: "EUR" }`; values in brackets are `amountMicros` (1/1,000,000 EUR). GiB = 1,073,741,824 bytes.

## 3. Resellers

| id | name | tenants owned |
|---|---|---|
| `r_northwind` | Northwind Hosting | 1,200 |
| `r_bluepeak` | BluePeak Cloud | 800 |
| `r_orbit` | Orbit Systems | 500 |

The remaining tenants have `resellerId: null` (direct customers of the provider).

## 4. Tenants (10,000)

- `t_acme` (name `acme`, display "Acme Corporation", plan Business, reseller `r_northwind`, active) always exists. It's the demo tenant for tenant roles. Quotas (D2-05): storage **250 GiB** with **205 GiB** used (82%), VM quota **50** with **40** VMs.
- Other tenant IDs are `t_` + 5 lowercase base-36 characters from the seeded RNG (D2-06).
- The rest: names are `<adjective>-<noun>-<n>` slugs (e.g. `brave-otter-17`), unique.
- Status distribution: active 85%, suspended 8%, provisioning 2%, error 5% (exactly 8,500 / 800 / 200 / 500).
- Plan distribution: Starter 50%, Business 30%, Enterprise 15%, Unlimited 5% (exactly 5,000 / 3,000 / 1,500 / 500).
- Quotas: plan defaults ± random within plan max. Usage: 0–110% of quota (about 4% over quota, so warning/danger states show up).
- `createdAt`: spread over the last 3 years.
- Reserved names for tests: `acme` (exists, use for TENANT_NAME_TAKEN), `taken-name` (exists).

## 5. VMs (tenant `t_acme`: 40; other tenants: generated on demand, 0–20 each)

- Names `web-01…web-12`, `db-01…db-04`, `worker-01…worker-20`, `cache-01…cache-04`.
- IDs are assigned in the name order above and are stable for any `MOCK_SEED`:

  | IDs | Names |
  |---|---|
  | `vm_01`–`vm_12` | `web-01`–`web-12` |
  | `vm_13`–`vm_16` | `db-01`–`db-04` |
  | `vm_17`–`vm_36` | `worker-01`–`worker-20` |
  | `vm_37`–`vm_40` | `cache-01`–`cache-04` |

- VMs of other tenants use `vm_<tenantId-suffix>_<nn>` (e.g. `vm_8f2k1_03`); they're generated lazily but deterministically from (`MOCK_SEED`, `tenantId`) (D2-06), and never referenced by tests.
- Status: running 70%, stopped 25%, error 5%. Sizes: 1–16 vCPU, 1–64 GiB RAM, 20–500 GiB disk.
- `ip`: `10.0.x.y` when running, `null` when stopped.
- Image: one of `ubuntu-24.04`, `debian-13`, `rocky-10`, `windows-2025`.

## 6. Buckets (tenant `t_acme`: 15)

- Names like `acme-assets`, `acme-backups`, `acme-logs-2026`; one empty bucket `acme-scratch` (deletable); `acme-backups` holds objects (used for BUCKET_NOT_EMPTY).
- Total usage for `t_acme`: about 82% of its storage quota, so the warning state is visible by default.

## 7. Task runner and events

| Kind | Duration | Progress events | Failure |
|---|---|---|---|
| vm.start | 3–5 s | every 500 ms | 0% |
| vm.stop | 3–5 s | every 500 ms | 0% |
| vm.reboot | 5–8 s | every 500 ms | reboot failure rate (0.1 in `dev`/`demo`, 0 in `e2e`; `MOCK_FAILURE_RATE` overrides) → `VM_BUSY` |
| tenant.suspend / resume | 2–4 s | every 500 ms | 0% (or forced with `/api/__test/fail-next-task`) |
| tenant.provision | 4–6 s | every 500 ms | 0% |

- Every task starts with `seq: 0` (the value in the 201/202 response). The runner increments `seq` on every emitted `task.updated`.
- On completion the runner emits `task.updated` (final) and then `vm.updated` / `tenant.updated`.
- `quota.updated { tenantId, quotas }` is emitted on `updateQuotas`, bucket create/delete, plan change, and every 60 s while usage is changing.
- `bucket.updated { tenantId, bucket | null, name }` is emitted on create, delete (`bucket: null`) and size changes.
- **Task visibility (`listTasks`, `getTask`, D2-07):** the same scoping as events: providers see all tasks, resellers tasks of their tenants, tenant roles tasks of their own tenant.
- **Event scoping (RT-12):** a session receives events about resources it can read, plus `tenant.updated` and `quota.updated` for its own tenant (`me.tenant.id`) even without `tenant:read`. Resellers receive events for their own tenants, providers for all.
- **WebSocket** `/api/events`: heartbeat every 15 s. The session is checked at upgrade and on every heartbeat tick; on expiry or sign-out all of that session's sockets close with **4401**. A foreign `Origin` closes with **4403**. A session may hold at most **5** sockets; the 6th is closed with **4429**.
- Tasks are kept for 24 hours. Seeded finished tasks for `t_acme`, timestamps relative to the seed time (server start, or the last `POST /api/__test/reset`; tests that check relative times call reset first):

  | Kind | Resource | Status | createdAt |
  |---|---|---|---|
  | vm.start | `vm_01` (web-01) | succeeded | now − 10 min |
  | vm.stop | `vm_19` (worker-03) | succeeded | now − 30 min |
  | vm.reboot | `vm_14` (db-02) | failed, `VM_BUSY` | now − 60 min |
  | vm.reboot | `vm_37` (cache-01) | succeeded | now − 2 h |
  | tenant.provision | `t_acme` (acme) | succeeded | now − 4 h |

  The `tenant.provision` row deliberately exercises the plain-text resource case for tenant roles (AC-TSK-1.6).

## 8. Environment variables and test endpoints

### Mode (`NIMBUS_MODE`, mock-api and gateway)

| `NIMBUS_MODE` | Used by | Test endpoints | Latency | Reboot failure rate | Seed | Frontend build mode |
|---|---|---|---|---|---|---|
| `dev` | `pnpm dev` | on | 150 ms | 0.1 | 42 | `development` |
| `e2e` | CI and local e2e; `pnpm demo:local` (live interview demo, with `MOCK_LATENCY_MS=150` and `MOCK_FAILURE_RATE=0.1`) | on | 0 | 0 | 42 | `e2e` |
| `demo` | public preview deploy only (test endpoints stay off so viewers can't break it for others) | off | 150 ms | 0.1 | 42 | `production` |

- **Required.** A missing or invalid value stops the server at start-up with a clear error, so test endpoints are never switched on by accident.
- The mode only sets **defaults**; `MOCK_LATENCY_MS`, `MOCK_FAILURE_RATE`, `MOCK_SEED` and `MOCK_SESSION_TTL_S` can still override them individually.
- Config is validated with Zod at start-up and logged once, e.g. `[mock-api] mode=e2e latency=0 failureRate=0 seed=42 sessionTtl=28800`.
- `NODE_ENV` is never read by our own code.

### mock-api

| Var | Default | Use |
|---|---|---|
| `NIMBUS_MODE` | — (required) | `dev` · `e2e` · `demo` (table above) |
| `PORT` | 4000 | |
| `MOCK_SEED` | from mode (42) | deterministic data |
| `MOCK_LATENCY_MS` | from mode | added to every HTTP response |
| `MOCK_FAILURE_RATE` | from mode | reboot failure rate |
| `MOCK_SESSION_TTL_S` | 28800 | session lifetime; also drives socket expiry (4401) |
| `APP_ORIGINS` | `http://localhost:8080,http://localhost:4200,https://localhost:8443` | allowed `Origin` values for mutating requests and WebSocket upgrades (gateway, shell dev server, nightly HTTPS gateway). `pnpm e2e:stack` / `demo:local` derive the gateway entry from `GATEWAY_PORT` (D2-09) |

Test-only endpoints, under `/api/__test/` so the gateway proxies them and the `Path=/api` session cookie is sent. They exist only when `NIMBUS_MODE` is `dev` or `e2e`, never in `demo`:

| Endpoint | Body | Acts on |
|---|---|---|
| `POST /api/__test/reset` | — | everything: re-seed (seeded task times become relative to now) |
| `POST /api/__test/expire-session` | `{ "all": true }` optional | the caller's session (cookie); `all` expires every session (AC-SHL-1.4) |
| `POST /api/__test/drop-sockets` | `{ "all": true }` optional | the caller's sockets, closed with 1001; `all` drops every socket (AC-SHL-6.4) |
| `POST /api/__test/fail-next-task` | `{ kind, code }` | global: the next task of `kind` fails with `code` (AC-TEN-4.3) |
| `POST /api/__test/set-usage` | `{ tenantId, usedBytes }` | that tenant's storage usage, e.g. to fill the quota (AC-STO-2.3) |
| `POST /api/__test/emit` | any `ServerEvent` | broadcast, subject to RT-12 scoping |

### Gateway (`apps/gateway`)

Resolution order (SPEC.md §2.2):
1. `/api/*` → proxy to mock-api (including the `/api/events` WebSocket upgrade).
2. `/remotes.json` → `config/remotes.gateway.json`.
3. `/remotes/<name>/*` → that remote's static files (built). A missing file returns **404 and never falls back**.
4. A real file in the shell's build → serve it.
5. Any other `GET` or `HEAD` whose `Accept` includes `text/html` → the shell's `index.html` with **200**.
6. Anything else → 404.

| Var | Default | Use |
|---|---|---|
| `NIMBUS_MODE` | — (required) | `dev` · `e2e` · `demo`; test endpoints only in `dev` / `e2e` |
| `GATEWAY_PORT` | 8080 (8443 with `TLS=1`) | local stacks also read it from `.env` (`.env.example` sets 8090); Playwright's `baseURL` and `APP_ORIGINS` use the same value |
| `TLS` | (unset) | `1` → serve HTTPS with a self-signed cert, used by the nightly cross-browser suite at `https://localhost:8443` |
| `MOCK_API_URL` | `http://localhost:4000` | proxy target |
| `FAIL_REMOTES` | (unset) | comma-separated remote names, e.g. `storage` → 503 for `/remotes/storage/*` (live demo) |

Test-only (`NIMBUS_MODE` `dev` or `e2e`), at the gateway root because it needs no session: `POST /__test/fail-remotes { "remotes": ["storage"] }` toggles failing remotes without a restart; `{ "remotes": [] }` restores them. E2E doesn't use this; it intercepts routes with Playwright (SPEC-SHL-4).

## 9. Error codes → UI messages

The UI maps `Problem.code` to these messages (`libs/messages/src/en.ts`, key `errors.<CODE>`), filling placeholders from `Problem.params` (MSG-3). Field-level `errors[]` override them per field. Unknown codes show `errors.INTERNAL`.

| Code | HTTP | Params | UI message |
|---|---|---|---|
| UNAUTHENTICATED | 401 | — | Your session expired. Please sign in again. |
| FORBIDDEN | 403 | — | You don't have permission to do this. |
| NOT_FOUND | 404 | — | This item no longer exists. |
| VALIDATION_FAILED | 422 | — | Some fields need attention. |
| TENANT_NAME_TAKEN | 409 | — | This name is already taken. |
| TENANT_NOT_ACTIVE | 409 | — | Only active tenants can be suspended. (only for `suspendTenant`) |
| TENANT_SUSPENDED | 409 | — | `errors.TENANT_SUSPENDED`: This tenant is suspended, so changes are disabled. |
| TENANT_NOT_SUSPENDED | 409 | — | Only suspended tenants can be resumed. |
| QUOTA_EXCEEDS_PLAN | 422 | `resource`, `plan`, `max` | by `resource`: `errors.QUOTA_EXCEEDS_PLAN.storage` "{plan} allows up to {max}." (`max` bytes via `formatBytes` → "100 GiB") · `errors.QUOTA_EXCEEDS_PLAN.vms` "{plan} allows up to {max} VMs." (`max` count via `formatCount` → "10") |
| QUOTA_BELOW_USAGE | 422 | `resource`, `used` | by `resource`: `errors.QUOTA_BELOW_USAGE.storage` "Storage quota can't be lower than current usage ({used})." (`used` via `formatBytes`) · `errors.QUOTA_BELOW_USAGE.vms` "VM quota can't be lower than the current number of VMs ({used})." (`used` via `formatCount`) |
| QUOTA_EXCEEDED | 422 | — | Storage quota is full. Free up space or ask an admin to raise the quota. |
| VM_BUSY | 409 | `name` | {name} is busy with another operation. |
| VM_INVALID_STATE | 409 | `name`, `action`, `status` | {name} can't {action} while it's {status}. |
| BUCKET_NAME_TAKEN | 409 | — | A bucket with this name already exists. |
| BUCKET_NOT_EMPTY | 409 | — | Empty the bucket before deleting it. |
| RATE_LIMITED | 429 | — | Too many requests. Try again in a moment. |
| INTERNAL | 500 | — | Something went wrong on our side. Try again. |

Byte params are formatted with `formatBytes` (SPEC.md §9), e.g. `max: 107374182400` → "100 GiB".

## 10. Other UI messages referenced by ACs

Shared keys live in `libs/messages`; area keys in `apps/<area>/src/messages/en.ts`. Rows marked `draft` were written by the agent in v1.3 and await review by Rasul; `trace:check` warns while any `draft` remains (MSG-4). Rows marked `accepted` come from the v1.4 decision record.

| Key | Text | Used by | Status |
|---|---|---|---|
| `shell.noAccess.title` | 403 – No access | AC-SHL-3.1 | `draft` |
| `common.loading` | Loading… | SPEC-SHL-1 boot, ui-kit | `draft` |
| `common.retry` / `close` / `cancel` / `confirm` / `next` / `back` / `dismiss` | Retry / Close / Cancel / Confirm / Next / Back / Dismiss | ui-kit (§8.2) | `draft` |
| `common.actions` | Actions | ui-kit DataTable | `draft` |
| `common.notifications` | Notifications | ui-kit Toast region | `draft` |
| `common.stepOf` | Step {current} of {total} | ui-kit Wizard | `draft` |
| `common.typeToConfirm` | Type {value} to confirm. | ui-kit ConfirmDialog | `draft` |
| `common.errorTitle` | Something went wrong | ui-kit ErrorState | `draft` |
| `usage.warning` / `usage.danger` | Approaching quota / At or over quota | ui-kit UsageBar (NFR-A11Y-3) | `draft` |
| `auth.title` | Sign in to Nimbus Console | SPEC-SHL-1 | `draft` |
| `auth.roleLabel` | Sign in as | SPEC-SHL-1 | `draft` |
| `roles.provider_admin` / `reseller_admin` / `tenant_admin` / `tenant_viewer` | Provider admin / Reseller admin / Tenant admin / Tenant viewer | SPEC-SHL-1, D3-01 | `draft` |
| `auth.signIn` | Sign in | SPEC-SHL-1 | `draft` |
| `auth.signOut` | Sign out | SPEC-SHL-1, D3-01 | `draft` |
| `shell.noAccess.body` | You don't have access to this page. | AC-SHL-3.1 | `draft` |
| `shell.noAccess.goHome` | Go to {area} | AC-SHL-3.1 | `draft` |
| `shell.notFound` | Page not found | SPEC-SHL-2 | `draft` |
| `shell.userMenu` | Account | D3-01 | `draft` |
| `shell.remoteUnavailable` | {area} is temporarily unavailable. | AC-SHL-4.1 | `draft` |
| `shell.runningTasks_one` / `_other` | {count} running task / {count} running tasks | AC-SHL-2.2 | `draft` |
| `shell.tenantContext` | {displayName} · {planName} · {status} | AC-SHL-8.1 | `draft` |
| `tenantStatus.suspendedBanner` | This tenant is suspended. You can view resources but can't change them. | AC-SHL-8.2 | `draft` |
| `status.tenant.active` / `suspended` / `provisioning` / `error` | Active / Suspended / Provisioning / Error | AC-SHL-8.1 | `draft` |
| `connections.connecting` | Connecting… | WS-7 | `draft` |
| `tenants.empty` | No tenants yet | SPEC-TEN-1 states | `draft` |
| `tenants.noMatches` | No tenants match your filters | SPEC-TEN-1 states | `draft` |
| `tenants.nameInvalid` | Use lowercase letters, numbers and hyphens. | AC-TEN-2.1 | `draft` |
| `tenants.discardChanges` | Discard changes? | SPEC-TEN-2 | `draft` |
| `tenants.toast.created` | Tenant {name} created. | SPEC-TEN-2 | `draft` |
| `tenants.toast.suspended` / `resumed` | Tenant {name} suspended. / Tenant {name} resumed. | SPEC-TEN-4 | `draft` |
| `compute.vmNowStatus` | {name} is now {status}. | AC-CMP-1.4 | `draft` |
| `compute.operationInProgress` | Operation in progress | AC-CMP-2.4 | `draft` |
| `compute.toast.started` / `stopped` / `rebooted` | {name} started. / {name} stopped. / {name} rebooted. | SPEC-CMP-2 | `draft` |
| `compute.chooseTenant` | Choose a tenant to see its virtual machines. | SPEC-CMP-4 | `draft` |
| `compute.actingOnTenant` | Acting on tenant {displayName} | SPEC-CMP-4 | `draft` |
| `storage.usagePercent` | {percent}% of quota used | AC-STO-1.1 | `draft` |
| `storage.bucketNameInvalid` | Use 3–63 lowercase letters, numbers, dots and hyphens. | AC-STO-2.1 | `draft` |
| `storage.bucketNameIp` | Bucket names can't look like IP addresses. | AC-STO-2.2 | `draft` |
| `storage.toast.created` / `deleted` | Bucket {name} created. / Bucket {name} deleted. | SPEC-STO-2 | `draft` |
| `storage.chooseTenant` | Choose a tenant to see its buckets. | SPEC-STO-3 | `draft` |
| `rbac.disabledTooltip` | You don't have permission to {action}. | RBAC-4, AC-TEN-4.4 | `accepted` |
| `actions.createTenant` | create tenants | RBAC-4 | `accepted` |
| `actions.suspendTenant` | suspend tenants | AC-TEN-4.4 | `accepted` |
| `actions.resumeTenant` | resume tenants | RBAC-4 | `accepted` |
| `actions.updateQuota` | change quotas | RBAC-4 | `accepted` |
| `actions.operateVm` | start, stop or reboot VMs | RBAC-4 | `accepted` |
| `actions.createBucket` | create buckets | RBAC-4 | `accepted` |
| `actions.deleteBucket` | delete buckets | RBAC-4 | `accepted` |
| `areas.tenants` / `areas.storage` / `areas.compute` | Tenants / Storage / Compute | `shell.remoteUnavailable` | `accepted` |
| `connections.label` | Connection | AC-SHL-6.4 | `accepted` |
| `connections.connected` / `.reconnecting` / `.offline` | Connected / Reconnecting… / Offline | AC-SHL-6.4, AC-SHL-6.9 | `accepted` |
| `tenants.list.count` | Showing {shown} of {total} tenants | SPEC-TEN-1 | `accepted` |
| `tenantStatus.suspendedAdminBanner` | {tenant} is suspended. Resume it to make changes. | SPEC-CMP-4, SPEC-STO-3, AC-CMP-4.4 | `accepted` |
| `tenantStatus.suspendedTooltip` | Changes are disabled while this tenant is suspended. | SPEC-CMP-4, SPEC-STO-3, SPEC-TEN-3, AC-CMP-4.4 | `accepted` |
