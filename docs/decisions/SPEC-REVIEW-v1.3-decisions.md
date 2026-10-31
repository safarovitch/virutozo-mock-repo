# Spec review v1.2 → v1.3 — Decisions

- **Status:** Accepted · **Date:** 2026-10-30 · **Owner:** Rasul Idiev
- **Input:** "Spec review, second pass (v1.2)". Closes **all of N1–N30**, the section E items (including R5, R7–R12, R22, R23, R31, R62, R75), and every AC in section D. Remaining section C items are listed in §14 for the next batch.
- **Supersedes:** `SPEC-REVIEW-v1.2-decisions.md` (that draft collided with existing AC IDs and assumed tenant roles still had `tenant:read`).
- **Contract check:** the TypeSpec constructs used here (cookie auth, CSRF header, `Money`, `Problem.params`, `TenantCreated`) were test-compiled with TypeSpec 1.17 on 2026-10-30.

### How new ACs are numbered
New acceptance criteria are labelled **`D<n>.<letter>`** below (e.g. `D1.a`). When applying, the agent gives each one the **next free AC number in the named spec** and records the mapping in the changelog (e.g. `D1.a → AC-SHL-1.9`). Rewritten ACs keep their existing IDs. All new ACs start with status `planned`.

| # | Topic | Closes |
|---|---|---|
| D1 | Same-origin gateway and cookie session | N1, N2, N3, N10, N11 |
| D2 | Multi-tab session | N5 |
| D3 | WebSocket session expiry; how "session expired" reaches `/login` | N6, N9, R14 (rest), R18 |
| D4 | Scoped bus, bus lifecycle, logger | N14, N24, N25, N26, R24 |
| D5 | One query client per area; freshness | N15, N16, N17, R85 |
| D6 | Task merging; tasks from tenant operations | N18, N19, R44, R71, R72 |
| D7 | What tenant roles see about their own tenant | N12, N13 |
| D8 | Messages and formatting | R7–R12, R31 |
| D9 | Plan pricing unit | R5 |
| D10 | Remote-failure simulation | R22, R23 |
| D11 | Compute and Storage for provider and reseller admins | R62, R75 |
| D12 | Small session fixes | N4, N7, N8 |
| D13 | Remote errors, context updates, 401 handling | N20, N21, N22, N23, R95 |
| D14 | Traceability rules | N27, N28, N29, N30 |
| D15 | Making section D ACs testable | Section D |

---

## D1 — Same-origin gateway and cookie session
**Closes:** N1, N2, N3, N10, N11

### Decision
1. **One origin for everything,** served by a new `apps/gateway` (Fastify + `@fastify/static` + `@fastify/http-proxy`, port **8080**):

   | Path | Served by |
   |---|---|
   | `/` | shell (built) |
   | `/remotes/tenants/`, `/remotes/storage/`, `/remotes/compute/` | remotes (built) |
   | `/api/*` | mock-api (REST) |
   | `/api/events` | mock-api (WebSocket upgrade, proxied) |

   - **CI e2e, preview and demo** all run against the gateway at `http://localhost:8080`. Vite preview ports (4173 etc.) are never used by tests, so CORS can't block e2e (**N2**).
   - **Development:** the shell's Vite dev server (4200) proxies `/api` (`ws: true`) to 4000, so the API is same-origin in dev too. Remotes load from their own dev servers (4201–4203) for hot reload. That traffic is static code only, with no credentials.
   - **No CORS anywhere.** The client uses `credentials: 'same-origin'` (set explicitly in `customFetch`), and the server sends no `Access-Control-Allow-*` headers (**N3**).
2. **Session cookie:** `POST /api/login` sets `nimbus_session` with `HttpOnly; Secure; SameSite=Strict; Path=/api`. `Secure` is stated explicitly (**N1**). Browsers treat `http://localhost` as secure, so this works locally.
3. **CSRF:** every mutating request needs header `X-Nimbus-Csrf: 1` (added by `customFetch`). The server also rejects mutating requests and WebSocket upgrades whose `Origin` isn't the app origin.
4. **Main-branch preview deploy** (§12, **N1**): GitHub Pages is dropped. If the preview is built (stretch), it's **one container** (gateway + mock-api + built assets) on a single host, so it stays same-origin.
5. **Expiry is detected only by a 401 or WebSocket close 4401** (D3). The client never tracks an expiry time. Remove `Session` and `expiresAt` from the contract; `login` returns `Me` (**N10**).
6. Rename `MOCK_TOKEN_TTL_S` → **`MOCK_SESSION_TTL_S`** (**N11**).

### Changes
- **Contract:** `@useAuth(SessionCookie)` with `model SessionCookie is ApiKeyAuth<ApiKeyLocation.cookie, "nimbus_session">`. `model CsrfHeader { @header("X-Nimbus-Csrf") csrf: "1"; }` spread into every POST/PUT/PATCH/DELETE. `login` → `200` with `Set-Cookie` and body `Me`. Remove `Session`. `events` has no parameters.
- **SPEC:** NFR-SEC-3 becomes *"No session secret is readable by JavaScript: httpOnly, Secure, SameSite=Strict cookie (ADR-0005)."* Add NFR-SEC-6 (CSRF header + Origin check). NFR-SEC-1 CSP: `connect-src 'self'`. Add `apps/gateway` to §2.3, port 8080 to §2.1. §12: e2e against the gateway; preview deploy per point 4.
- **ADR-0005:** write it now (*Same-origin gateway + httpOnly cookie*), listing the rejected options: in-memory token, and cross-site `SameSite=None` cookies with CSRF tokens. This also closes the ADR-0005 part of R94.
- **ADR-0001:** R3 remote URLs are paths (`/remotes/tenants/remoteEntry.js`); R4 adds gateway port 8080.
- **mock-data §8:** rename the variable; add the Origin and CSRF checks.

### New ACs (SPEC-SHL-1)
- **D1.a** After sign-in, `document.cookie` doesn't include `nimbus_session`, and `localStorage`/`sessionStorage` hold no session data.
- **D1.b** A mutating request without `X-Nimbus-Csrf`, or with a foreign `Origin`, gets 403 `FORBIDDEN` (mock-api integration test).
- **D1.c** Reloading any page keeps the user signed in.

---

## D2 — Multi-tab session
**Closes:** N5

### Decision
The shell keeps tabs in sync over `BroadcastChannel('nimbus:session')`. Messages carry no secrets.

| Message | Sent when | Every other tab |
|---|---|---|
| `{ type: 'signed-out' }` | *Sign out* clicked | unmount remotes, reset bus (D4), clear shell cache, go to `/login` |
| `{ type: 'expired' }` | this tab saw a 401 or close 4401 | same, with `/login?reason=expired` (D3) |
| `{ type: 'signed-in', userId }` | sign-in succeeded | different `userId` → full page reload; same user → refetch `/me` and call `update(ctx)` on mounted remotes |

Each tab keeps its own WebSocket (RT-1 is per tab).

### New SPEC-SHL-7 *Multi-tab session* (ACs)
- **D2.a** Signing out in tab A sends tab B to `/login` within 1 s, without user action.
- **D2.b** Signing in as a different role in tab A makes tab B reload and show that role's areas and actions.
- **D2.c** An expiry seen in tab A shows "Your session expired" in tab B.

E2E: two pages in one Playwright browser context (shared cookies).

---

## D3 — WebSocket session expiry, and the "session expired" message
**Closes:** N6, N9, R14 (remaining part), R18

### Decision
**Close codes** (4000–4999 is the application range):

| Code | Meaning | Client |
|---|---|---|
| **4401** | session missing, expired or signed out | don't reconnect → `session:expired` → `/login?reason=expired` |
| **4403** | `Origin` rejected | don't reconnect → state `offline` → log error |
| **4429** | too many connections | reconnect with backoff, minimum 30 s |
| 1000 / 1001 | normal close / server going away | reconnect with backoff (WS-1) |
| **1006** | network failure **or** HTTP 401 at the handshake (browsers can't tell them apart) | call `GET /api/me`: 401 → as 4401; otherwise reconnect with backoff |

- **Server:** checks the session at upgrade and on every heartbeat tick (15 s). On expiry or sign-out it closes **all** of that session's sockets with 4401.
- **Client:** with no message for 45 s, it closes the socket and reconnects.
- **Connection states (R18):** `connecting` → `connected`; on loss → `reconnecting`. It becomes **`offline`** after 5 consecutive failed attempts, when `navigator.onLine` is false, or on close 4403. While offline the client keeps retrying every 30 s (except after 4403). An `online` browser event triggers an immediate retry.

**How the message reaches `/login` (N9):** the redirect goes to `/login?reason=expired&returnTo=<path>`. The login page shows "Your session expired. Please sign in again." whenever `reason=expired` is present, so it **survives a reload** of `/login`. A successful sign-in drops both parameters and navigates to the validated `returnTo` (D12).

### Changes
- **Contract:** `@extension("x-close-codes", …)` on `events`, documenting the table.
- **SPEC §6.3:** WS-5 (close codes), WS-6 (45 s heartbeat timeout), WS-7 (state definitions above). Rewrite AC-SHL-1.4 to use `?reason=expired`.
- **mock-data:** the server implements 4401, 4403 and 4429; `MOCK_SESSION_TTL_S` drives socket expiry too.

### New ACs (SPEC-SHL-6)
- **D3.a** On close 4401, the client doesn't reconnect and the user lands on `/login?reason=expired` with the expiry message.
- **D3.b** On 1006, the client calls `/api/me`: 401 → as D3.a; 200 → reconnect with backoff.
- **D3.c** With no message for 45 s, the client reconnects (unit test, fake timers).
- **D3.d** After 5 failed attempts the header indicator shows "Offline"; it shows "Connected" again after a successful retry.
- **D3.e** Reloading `/login?reason=expired` still shows the expiry message.

---

## D4 — Scoped bus, bus lifecycle and logger
**Closes:** N14, N24, N25, N26, R24

### Decision
**Scoped bus (N14).** The shell owns the root bus and passes each remote `rootBus.scope('<remote>')`:

```ts
export type RemotePublishable = 'task:started' | 'toast:show' | 'session:expired' | 'remote:error';

export interface ScopedBus {
  publish<K extends RemotePublishable>(type: K, payload: BusEvents[K]): void;
  subscribe<K extends BusEventName>(
    type: K,
    handler: (payload: BusEvents[K], meta: { source: string; ts: number }) => void,
  ): () => void;
}
```

- Remotes may only publish `RemotePublishable`. This is enforced by types, and at runtime: a disallowed publish throws in dev/test and is dropped and logged in production.
- Every delivery carries `meta.source`, and subscriber errors are logged with the subscriber's scope (RT-8).
- The shell calls `scope.dispose()` after `remote.unmount()`, removing all that remote's subscriptions even if it forgot. `rootBus.subscriberCount(source)` exists for tests.
- `RemoteContext.events: ScopedBus`.

**Lifecycle (N25).** The root bus lives for **one session**. On sign-out or expiry, the shell unmounts remotes, disposes all scopes, closes the WebSocket and creates a **new** root bus, so sticky `realtime:status` and all subscriptions start fresh.

**`realtime:reconnected` (N26)** is published only after a connection that **follows** a lost one, never on the first connection of a session.

**Logger (N24, R24).** New `libs/logger`, framework-agnostic: `logger.error | warn | info(event: string, data?: object)`.
- Output: `console` with prefix `[nimbus][<source>] <event>`, plus an in-memory ring buffer of the last 200 entries (`logger.entries()`), used by tests and a dev-only `/_debug` page.
- "Logged once" means **one entry per occurrence**. For example, one entry per invalid WebSocket message, with `event: 'realtime.invalid_message'`.
- Production builds keep `error` and `warn`, and drop `info`.

### Changes
- **`libs/mf-contract`:** `ScopedBus`, `RemotePublishable`, `createRootBus()`, `scope()`, `dispose()`, `subscriberCount()`.
- **SPEC §2.4/§2.5:** `events: ScopedBus`; MF-5 (dispose after unmount); RT-10 (bus per session); RT-11 (`reconnected` semantics). New §9 *Logging*.
- **Rewrite AC-SHL-6.2:** "an invalid message isn't published and creates exactly one `realtime.invalid_message` logger entry". **AC-SHL-6.3:** "`subscriberCount('compute')` is 0 after unmount". **AC-SHL-6.5:** "the logger entry names the failing subscriber's scope".

### New ACs (SPEC-SHL-6)
- **D4.a** A remote publishing `server:vm.updated` throws in tests and is dropped and logged in production builds.
- **D4.b** After sign-out and sign-in, no subscription from the previous session receives events.
- **D4.c** The first successful connection doesn't publish `realtime:reconnected`; a reconnection after a drop does, exactly once.

---

## D5 — One query client per area, and freshness
**Closes:** N15, N16, N17, R85

### Decision
1. **Every area creates its own `QueryClient`:** shell, tenants, storage and compute. The `@tanstack/react-query` **library** stays a shared singleton for bundle size; cache **instances** are not shared. Remove `queryClient` from `RemoteContext`, and update MF-2.
2. **Ownership = the cache instance.** Any area may call any operation it has permission for and cache the result in **its own** client (this answers N17: compute may call `getTask` into its Vue cache). No area touches another area's cache. Keys always come from Orval's generated helpers; hand-written keys are a lint error (`nimbus/no-handwritten-query-key`).
3. **Freshness comes from server events**, and each area applies them to its own cache:

   | Area | Caches | Applies |
   |---|---|---|
   | shell | `getMe`, `listTasks` (task center) | `server:task.updated` (via `mergeTask`, D6); `server:tenant.updated` → patch `Me.tenant` (D7) |
   | tenants | `listTenants`, `getTenant`, `getQuotas`, `listTasks?resourceId=` (drawer Activity, **N16**), `listPlans` | `server:tenant.updated`, `server:quota.updated`, `server:task.updated` for `resource.type = tenant` |
   | storage | `listBuckets`, `getQuotas` (usage card, **N15**) | `server:quota.updated`, `server:bucket.updated` |
   | compute | `listVms`, `getVm`, `getTask` for a VM's `activeTaskId` on mount (**N17**) | `server:vm.updated` (batched per frame), `server:task.updated` for `resource.type = vm` |

4. **New server events (R85):**
   - `quota.updated { tenantId, quotas: TenantQuotas }`: emitted on `updateQuotas`, bucket create/delete, plan change, and every 60 s while usage is changing.
   - `bucket.updated { tenantId, bucket: Bucket | null, name }`: emitted on create, delete (`bucket: null`) and size changes.
5. **Event scoping (R84):** the server only sends a session events about resources it can read. Tenant roles get events for their own tenant; resellers for their own tenants; providers for all.
6. **Reconnect resync:** on `realtime:reconnected`, each area invalidates only its own active queries.

### Changes
- **Contract:** add `QuotaUpdatedEvent` and `BucketUpdatedEvent` to `ServerEvent`.
- **BusEvents:** add `server:quota.updated` and `server:bucket.updated`.
- **SPEC:** replace RT-4 with the table; MF-2 "library shared, instances not shared"; add RT-12 (event scoping).

### New ACs
- **D5.a** (SPEC-TEN-3) After a quota update in the tenants area, a mounted storage usage card for that tenant updates without an HTTP request.
- **D5.b** (SPEC-STO-1) Creating or deleting a bucket updates the usage card and the bucket list from events.
- **D5.c** (SPEC-TEN-3) The drawer's Activity list shows a new suspend task and its progress live.
- **D5.d** (SPEC-CMP-1) Mounting compute while a VM has an `activeTaskId` shows that task's current progress within one `getTask` call.
- **D5.e** (SPEC-SHL-6) A tenant_admin's socket receives no events about other tenants (mock-api integration test).

---

## D6 — Task merging, and tasks from tenant operations
**Closes:** N18, N19, R44, R71, R72

### Decision
1. **`Task.seq`:** a per-task version that increases with every change (`0` in the 202/201 response).
2. **One merge function** (`libs/realtime`), used everywhere tasks are cached:
   ```ts
   export function mergeTask(current: Task | undefined, incoming: Task): Task {
     if (!current) return incoming;
     if (isTerminal(current.status)) return current;           // succeeded/failed never revert
     return incoming.seq > current.seq ? incoming : current;   // stale or duplicate → ignored
   }
   ```
   A late `task:started` (`seq: 0`) can never overwrite newer progress, in any arrival order (**N18**).
3. **Every task-producing response publishes `task:started`** from the area that called it (**N19**):

   | Operation | Response | Publisher |
   |---|---|---|
   | `createTenant` | `201 TenantCreated { tenant, task }` (**new**) | tenants (wizard) |
   | `suspendTenant`, `resumeTenant` | `202 Task` | tenants |
   | `runVmAction` | `202 Task` | compute |

4. **Rewrite AC-TSK-1.1 (R72):** "A task appears in the task center within 100 ms of the area receiving its 2xx response, whether or not a WebSocket update has already arrived." (Measured in a component test with fake timers, not e2e.)

### Changes
- **Contract:** `seq: int32` on `Task`; `TenantCreated`; `createTenant` 201 body.
- **mock-data §7:** the task runner increments `seq` on every emitted update.
- **SPEC:** SPEC-TEN-2 "On submit" and SPEC-TEN-4 publish `task:started`; SPEC-TSK-1 says all task upserts use `mergeTask`.

### New ACs (SPEC-TSK-1)
- **D6.a** A `seq: 2` update followed by `task:started` (`seq: 0`) leaves the task at its `seq: 2` state (unit test).
- **D6.b** A `succeeded` task never changes back to `running`.
- **D6.c** (SPEC-TEN-2) The provisioning task of a new tenant appears in the task center immediately after creation.
- **D6.d** (SPEC-TEN-4) Suspending a tenant shows its task in the task center immediately.

---

## D7 — What tenant roles see about their own tenant
**Closes:** N12, N13

### Decision
Keep v1.2's RBAC (tenant roles have no `tenant:read`, which is how R1 was fixed). Instead, **`Me` carries a read-only summary of the user's own tenant**:

```tsp
model TenantSummary {
  id: ResourceId;
  displayName: string;
  planName: string;
  status: TenantStatus;
}

// in Me:
@doc("Set for tenant_admin and tenant_viewer; null for provider/reseller admins.")
tenant: TenantSummary | null;
```

1. **Tenant context bar** in the shell header for users with `me.tenant`: display name · plan name · status badge, e.g. "Acme Corporation · Business · Active".
2. **Freshness:** `server:tenant.updated` for the user's own tenant patches `me.tenant.status` in the shell cache.
3. **Suspended tenant:** a global banner *"This tenant is suspended. You can view resources but can't change them."* All mutating actions are disabled with that text as tooltip. The server enforces it too: mutations return 409 `TENANT_NOT_ACTIVE`.
4. **What they can't see:** reseller, plan limits beyond their own quotas, pricing, other tenants.
5. **Task links (N13):** a task's *View resource* link is shown only if the user can open the target route, decided by `canOpen(resourceRef)` in `libs/auth`. Otherwise the resource name is plain text.
6. **Seeded `t_acme` tasks (N13, R87):**

   | Kind | Status | createdAt |
   |---|---|---|
   | vm.start (web-01) | succeeded | now − 10 min |
   | vm.stop (worker-03) | succeeded | now − 30 min |
   | vm.reboot (db-02) | failed, `VM_BUSY` | now − 60 min |
   | vm.reboot (cache-01) | succeeded | now − 2 h |
   | tenant.provision (acme) | succeeded | now − 4 h |

   The `tenant.provision` row deliberately exercises the plain-text case for tenant roles.

### Changes
- **Contract:** `TenantSummary`; `Me.tenant`; keep `tenantId` (or derive it from `tenant.id`, the agent's choice, but not both if they could disagree; prefer removing `tenantId`).
- **SPEC:** new SPEC-SHL-8 *Tenant context*. §1.3 persona goal stays true. mock-data §7 gets the table above.

### New ACs (SPEC-SHL-8)
- **D7.a** A tenant_viewer sees "Acme Corporation · Business · Active" in the header.
- **D7.b** When their tenant becomes suspended (`tenant.updated`), the banner appears and VM and bucket actions are disabled without a reload.
- **D7.c** (SPEC-TSK-1) For tenant roles, the `tenant.provision` task shows "acme" as plain text, not a link.

---

## D8 — Messages and formatting
**Closes:** R7–R12, R31

### Decision
**Messages**
- **M1** Every user-facing string lives in a typed catalogue: shared strings in `libs/messages/src/en.ts` (errors, common actions, statuses, connection states), area strings in `apps/<area>/src/messages/en.ts`. A missing key is a type error.
- **M2** Placeholders use `{name}` and are always inserted as text, never HTML. Plurals use `…_one` / `…_other` keys chosen with `Intl.PluralRules('en')`.
- **M3** **Server text is never shown (R10).** The UI shows the message for `Problem.code`, filled from the new **`Problem.params` (R11)**. Unknown codes show the `INTERNAL` message. `title`/`detail` go to the logger only. This changes SPEC-TEN-1 (error state), AC-TEN-4.3 and AC-TSK-1.3 to "the mapped message".
- **M4** **Single source of wording (R7–R9, R12).** `specs/mock-data.md` §9 is the source for error texts. ACs quote message **keys** plus the expected text, and the agent fixes every punctuation or text difference in favour of §9. Every UI string referenced by an AC but missing from §9 or the area catalogues gets added (R12). A unit test checks that every `ErrorCode` has a message.

**Formatting** (`libs/format`, framework-agnostic, shared by React and Vue; every row unit-tested):

| What | Rule | Example |
|---|---|---|
| Bytes | binary units; **trailing `.0` dropped (R31)**; one decimal otherwise; none for B | `100 GiB`, `1.5 GiB`, `0 B` |
| Quota input | whole GiB, converted to bytes | `100` → `107374182400` |
| Percent | display `Math.floor`; thresholds use the exact ratio | 79.9% → "79%", no warning |
| Over quota | real value, danger style | `104%` |
| Date/time | `Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })`, browser time zone; tooltip shows ISO UTC | `30 Oct 2026, 22:01` |
| Recent (< 24 h) | `Intl.RelativeTimeFormat('en', { numeric: 'auto' })` | `2 minutes ago` |
| Counts | `Intl.NumberFormat('en-GB')` | `10,000` |
| Money | `Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 4 })` on `amountMicros / 1e6` | `€0.035` |

### Changes
- **Contract:** `params?: Record<string | int64 | boolean>` on `Problem`.
- **SPEC:** new §9 *Messages & formatting* (M1–M4 + table). NFR-I18N-1 points to it. AC-STO-1.2 references `libs/format`.
- **Lint:** `nimbus/no-server-text` flags rendering `problem.title`/`problem.detail`.

### New ACs (SPEC-SHL-9 *Messages*)
- **D8.a** Every `ErrorCode` has a message (unit test over the enum).
- **D8.b** An unknown code shows "Something went wrong on our side. Try again."
- **D8.c** `QUOTA_EXCEEDS_PLAN` with `{ plan: "Starter", max: 107374182400 }` shows "Starter allows up to 100 GiB."

---

## D9 — Plan pricing unit
**Closes:** R5

### Decision
Prices are integer **micro-units** (1/1,000,000 of the currency unit):

```tsp
model Money {
  @doc("Amount in micro-units (1/1,000,000 of the currency unit). 0.035 EUR = 35000.")
  amountMicros: int64;
  currency: string; // ISO 4217
}
```

`Plan` replaces `currency`, `pricePerGiBMonthMinor` and `pricePerVcpuMonthMinor` with `pricePerGiBMonth: Money` and `pricePerVcpuMonth: Money`.

| Plan | per GiB-month (micros) | per vCPU-month (micros) |
|---|---|---|
| Starter | 40,000 (€0.04) | 6,000,000 (€6.00) |
| Business | 35,000 (€0.035) | 5,500,000 (€5.50) |
| Enterprise | 30,000 (€0.03) | 5,000,000 (€5.00) |
| Unlimited | 25,000 (€0.025) | 4,500,000 (€4.50) |

---

## D10 — Remote-failure simulation
**Closes:** R22, R23

### Decision
Remove `MOCK_FAIL_REMOTE` from mock-api, which doesn't serve remote files.

| Where | How |
|---|---|
| **E2E** | `page.route('**/remotes/storage/**', r => r.fulfill({ status: 503 }))`. To restore it (AC-SHL-4.4): `page.unroute(...)`, then click *Retry*. Deterministic, no env vars. |
| **Live demo** | gateway env `FAIL_REMOTES=storage` (comma-separated) → 503 for `/remotes/storage/*`. Toggle without a restart: `POST /__test/fail-remotes { "remotes": ["storage"] }` (non-production only). |
| **Render-time crash** (AC-SHL-4.3) | each remote has a `/__crash` route in non-production builds that throws during render. |

### Changes
- mock-data §8: remove `MOCK_FAIL_REMOTE`; new *Gateway* section. SPEC §6.4 and §15 step 4 use the gateway toggle. E2E-6 uses route interception.

---

## D11 — Compute and Storage for provider and reseller admins
**Closes:** R62, R75

### Decision
1. **Tenant picker.** For users with `me.tenant === null`, Compute and Storage show a searchable tenant combobox (`listTenants`, server-scoped). The selection is in the URL (`?tenantId=t_acme`).
2. **Before a choice:** empty state *"Choose a tenant to see its virtual machines"* / *"…its buckets."*
3. **Actions follow the RBAC matrix unchanged:**
   - provider_admin may operate VMs. A context line *"Acting on tenant Acme Corporation"* is shown, and **every** VM action asks for confirmation naming the tenant.
   - reseller_admin is read-only.
   - Bucket create/delete stays tenant_admin only.
4. **Server scoping:** a `tenantId` outside the caller's scope returns **404 `NOT_FOUND`**, so existence isn't leaked. Provider/reseller calls without `tenantId` return 422 `VALIDATION_FAILED`. Usage card (R75): `getQuotas(tenantId)` for the picked tenant.
5. The tenant drawer (SPEC-TEN-3) gets *View VMs* and *View buckets* links.

### New ACs
- **D11.a** (new SPEC-CMP-4) A provider_admin on `/compute` sees the picker and the empty state. Picking "acme" lists 40 VMs and sets `?tenantId=t_acme`.
- **D11.b** (SPEC-CMP-4) A reseller_admin sees their tenants' VMs without action buttons. A foreign `tenantId` shows "This item no longer exists."
- **D11.c** (SPEC-CMP-4) A provider_admin's *Stop* on a tenant's VM asks for confirmation naming the tenant.
- **D11.d** (new SPEC-STO-3) A provider_admin picking a tenant in Storage sees its buckets and usage card, without create/delete actions.

---

## D12 — Small session fixes
**Closes:** N4, N7, N8

- **N4, `returnTo` validation:** `const u = new URL(returnTo, location.origin)`. The value is valid only if `u.origin === location.origin`; then navigate to `u.pathname + u.search + u.hash`, and anything invalid goes to the home area. **Rewrite AC-SHL-1.8** with these cases:

  | Input | Result |
  |---|---|
  | `/tenants?status=active` | allowed |
  | `//evil.example` | rejected |
  | `/\evil.example` | rejected |
  | `https://evil.example/x` | rejected |
  | `javascript:alert(1)` | rejected |
  | `/%2F%2Fevil.example` | stays on the app origin (navigates to that literal path, which is harmless) |

- **N7, sign-out:** the client always clears local state and goes to `/login`, whatever `logout` returns (204, 401 or a network error). A 401 counts as success. Add an AC to SPEC-SHL-1: **D12.a** "Signing out after the session already expired still lands on `/login` with no error shown."
- **N8:** AC-SHL-1.6 names the role: "Given a **provider_admin**…".

---

## D13 — Remote errors, context updates and 401 handling
**Closes:** N20, N21, N22, N23, R95

### Decision
1. **Error boundaries live inside each remote (N21).** A React remote renders into **its own** React root, so the shell's boundary can't catch its render errors. That makes the rule the same for both frameworks:
   - React remotes wrap their root in an `ErrorBoundary`. The Vue remote uses `app.config.errorHandler`.
   - Errors during render or setup are published as `remote:error { remote, message, fatal: true }`. Other errors (event handlers, async work) are published with `fatal: false`.
   - On `fatal: true`, the shell unmounts that remote, disposes its scope and shows the MF-4 panel with *Retry*. Non-fatal errors are only logged.
   - The shell's own boundary covers load failures and a `mount()` that throws.
   - Rewrite AC-SHL-4.3 accordingly: "a render error in any remote (React or Vue) results in the MF-4 panel for that remote and one logger entry naming it."
2. **`update(ctx)` must be implemented (N22).** Each remote keeps the context reactive: a ref provided via `provide`/`inject` in Vue, a context provider or store in React. Components read session, permissions and path from it.
   - The shell calls `update` when the session changes (D2) and when the path under the remote's `basePath` changes.
3. **`RemoteContext.path` (R95):** the current path relative to `basePath`, plus search and hash (e.g. `/t_acme?tab=quotas`). Remotes sync their memory router to it on `mount` and `update`, and change it only via `ctx.navigate` (MF-1).
4. **Who publishes `session:expired` (N23):** `libs/api-client` exposes `configureApiClient({ onUnauthorized })`. Each area configures it at start-up:
   - Remotes: `onUnauthorized = () => ctx.events.publish('session:expired', { source })`.
   - The shell: calls its session store directly.
   - Since each area bundles its own copy of the client, each configures its own.
5. **Connection-state AC (N20).** Rewrite **AC-SHL-6.4** as two checks:
   - (a) Bus: a subscriber added while the state is `reconnecting` receives `{ state: 'reconnecting' }` synchronously on subscribe (unit test).
   - (b) UI: the header element with `role="status"` and name "Connection" shows "Reconnecting…" (e2e; the server drops sockets via `/__test/drop-sockets`).

### Changes
- **SPEC §2.4:** `RemoteContext` gains `path`; `update` semantics; MF-6 (boundaries live inside remotes). §2.5 `mount.ts` example implements `update`.
- **mock-api:** `POST /__test/drop-sockets`.

### New ACs (SPEC-SHL-4)
- **D13.a** After the shell calls `update` with a session that no longer has `vm:operate`, compute's action buttons disappear without a remount.
- **D13.b** Browser back/forward between `/compute` and `/compute/vm_01` updates the compute view through `ctx.path`.

---

## D14 — Traceability rules
**Closes:** N27, N28, N29, N30

- **N27, valid test-title prefixes.** One list, in `tools/trace/ids.ts`, used by both `trace:check` (T4) and the lint rule `nimbus/test-name-has-id`: `AC-`, `BUG-`, `TECH-`, `NFR-`, and rule IDs (`RT-`, `WS-`, `MF-`, `RBAC-`, `API-`, `TEST-`, `M`-rules as `MSG-`). TEST-1 and the lint rule are reworded to "starts with a known ID". The Day 1 smoke tests are renamed from `SHL-SMOKE-n` to `TECH-1: …`.
- **N28, single source of statuses.** After the split (Day 1, under TECH-1), ACs and their statuses live **only** in `specs/features/SPEC-*.md`, and §7 of SPEC.md becomes an index with links. `trace:check` parses `specs/features/` only, and fails if an AC ID is defined in more than one file. The demo script (§15) stays valid.
- **N29, TECH-7 split.** TECH-7 = hooks and lefthook (Day 1). The Day 7 harness work (skills, subagents, MCP server, evals, lint rules) moves to new IDs, taking the next free TECH numbers after TECH-11, one per item. Update §14.
- **N30, TECH statuses** follow the AC rules. The PR that works on a TECH item sets `in-progress` or `done` in `specs/tech-tasks.md`. T2 and T3 apply to TECH items: a `done` TECH item needs at least one test titled with its ID **or** a `verify:` line naming the CI job that proves it (e.g. `verify: ci/contract-check`). `trace:check` confirms that job exists.

---

## D15 — Making section D ACs testable
**Closes:** every row of section D

| AC | Fix |
|---|---|
| AC-TEN-1.1 (+R33) | Split it. **(a)** the DOM row limit (≤ 60) stays in the blocking e2e suite. **(b)** smoothness moves to a **non-blocking `perf` CI job** (Chromium, 4× CPU throttling via CDP, `PerformanceObserver` for long tasks, 3 runs, report the median). It reports on PRs and never fails them. |
| AC-TEN-3.1 | Use `t_acme` instead of `t_123`. Add AC: a non-existent ID shows the drawer's not-found state. |
| AC-TEN-4.3 | mock-api test endpoint `POST /__test/fail-next-task { kind: "tenant.suspend", code: "INTERNAL" }`. |
| AC-SHL-1.3 | Assert through the UI: after sign-out, *Back* stays on `/login`, and signing in as tenant_viewer shows no tenant rows from the previous session. A unit test checks that sign-out clears the shell's client; remote clients go away with unmount. |
| AC-SHL-1.4 | `POST /__test/expire-session` (no restart needed) plus `?reason=expired` (D3). |
| AC-SHL-1.6 | Role named (D12). |
| AC-SHL-4.2 | "Work" means each other route shows its heading and at least one data row. |
| AC-SHL-4.4 | `page.unroute` + *Retry* (D10). |
| AC-SHL-5.1 | Each metric is sent **at most once per page load**, flushed on `visibilitychange: hidden` **or** `pagehide`. E2E triggers the flush with `page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))` after stubbing `document.visibilityState`. |
| AC-SHL-5.3 | `/_vitals` covers the last 24 h of records. Ratings use web-vitals' standard thresholds. It's tested with records seeded via `reportVitals`. |
| AC-SHL-6.4 | Rewritten (D13). |
| AC-SHL-6.5 | Logger names the scope (D4). |
| AC-TSK-1.1 | Rewritten (D6). |
| AC-STO-2.3 | `POST /__test/set-usage { tenantId, usedBytes }` fills the quota. |
| AC-CMP-1.1, AC-CMP-1.2 | Unit tests with `vi.useFakeTimers({ toFake: ['requestAnimationFrame'] })`. AC-CMP-1.2 becomes "50 events in one frame result in **one cache write** (spy on `setQueriesData`)", which can be measured, unlike render counts. |

All test endpoints exist only when `NODE_ENV !== 'production'`. List them in mock-data §8.

---

## 13. File changes

| File | Changes |
|---|---|
| `contracts/main.tsp` | D1 cookie auth, `CsrfHeader`, `login`→`Me`, `logout`, remove `Session`, `events` without token · D3 `x-close-codes` · D5 `QuotaUpdatedEvent`, `BucketUpdatedEvent` · D6 `Task.seq`, `TenantCreated` · D7 `TenantSummary`, `Me.tenant` · D8 `Problem.params` · D9 `Money` |
| `SPEC.md` → **v1.3** | All decisions; the D-label → AC-ID mapping in the changelog |
| `specs/features/*.md` | New and rewritten ACs (status `planned`) |
| `specs/tech-tasks.md` | `verify:` lines; TECH-7 split |
| `specs/mock-data.md` | Cookie, CSRF, Origin; close codes; new events and scoping; `seq`; seeded tasks table; micro-unit prices; renamed TTL var; gateway section; test endpoints |
| `docs/adr/ADR-0005-…` (new) | Same-origin gateway + httpOnly cookie |
| `docs/adr/ADR-0001-…` | R3 path URLs; R4 port 8080 |
| `AGENTS.md` | Ports (+8080); new lint rules; H8 wording (cookie session); valid test-title prefixes |
| `prompts/day-1-foundation.md` | `apps/gateway`; smoke tests titled `TECH-1:`; e2e against 8080; remote URLs as paths |
| `prompts/day-2-contract.md` | Cookie/CSRF/Origin, close codes, new events, `seq`, test endpoints |

## 14. Not covered here (next batch)
R6, R13 (e2e part), R15–R17, R19–R21, R25, R26–R30 (except the two RUM ACs above), R34–R43, R45–R60, R63, R65–R70, R73, R74, R76–R83, R86, R88–R90, R93, R94 (ADRs other than 0005, plus the missing `requirements.md`/`stories/`), R96–R100.

---

## 15. Agent prompt

> Read `docs/decisions/SPEC-REVIEW-v1.3-decisions.md` in full, plus `SPEC.md`, `specs/features/`, `specs/tech-tasks.md`, `specs/mock-data.md`, `contracts/main.tsp`, `AGENTS.md`, ADR-0001 and `prompts/`.
>
> Apply D1–D15 exactly as written, using the file list in §13. Rules:
> - Change nothing that no decision requires. If a decision conflicts with the current spec, stop and list the conflict instead of choosing.
> - New ACs: give each `D<n>.<letter>` the next free AC number in the named spec, status `planned`, and record the mapping in the SPEC.md v1.3 changelog. Rewritten ACs keep their IDs.
> - Contract: edit `contracts/main.tsp` only, then `cd contracts && npm install && npm run build && npm run lint`. Both must pass.
> - Write ADR-0005.
>
> Finish with: a per-decision summary (D1…D15 → files and sections changed), the D-label → AC-ID mapping, the contract lint result, and any conflicts found. Then run the spec review again and report the status of every finding in N1–N30 and the section E items.
