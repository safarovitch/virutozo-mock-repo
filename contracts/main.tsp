// Nimbus API — contract source of truth (ADR-0003).
// Edit this file, then run `pnpm contract:build && pnpm api:generate`.
// Never hand-edit openapi.yaml or anything under libs/api-client/src/generated/.

import "@typespec/http";
import "@typespec/openapi";

using Http;
using OpenAPI;

@service(#{ title: "Nimbus API" })
@server("http://localhost:4000/api", "mock-api directly (apps/mock-api)")
@server("http://localhost:8080/api", "Gateway: one origin for app and API (ADR-0005)")
@tagMetadata("Auth", #{ description: "Demo sign-in and current session" })
@tagMetadata("Plans", #{ description: "Pricing plans and their limits" })
@tagMetadata("Tenants", #{ description: "Tenant lifecycle and quotas" })
@tagMetadata("Compute", #{ description: "Virtual machines" })
@tagMetadata("Storage", #{ description: "S3 buckets" })
@tagMetadata("Tasks", #{ description: "Long-running operations" })
@tagMetadata("Realtime", #{ description: "WebSocket event stream" })
@tagMetadata("RUM", #{ description: "Real-user monitoring (Web Vitals)" })
@info(#{ version: "1.0.0" })
@doc("Mock multi-tenant cloud API for Nimbus Console. Every operation lists its required permission in `x-permission`. Auth is an httpOnly session cookie set by `login`. Every mutating request to an authenticated endpoint (and `login`/`logout`) must send the header `X-Nimbus-Csrf: 1` and a same-origin `Origin`, else 403 FORBIDDEN; the client adds the header centrally, so it is not modelled per operation (ADR-0005, NFR-SEC-6). Every operation can also return 422, 429 and 500 (`CommonErrors`).")
@useAuth(SessionCookie)
namespace Nimbus;

@doc("httpOnly session cookie set by `login` (ADR-0005). JavaScript never reads it.")
model SessionCookie is ApiKeyAuth<ApiKeyLocation.cookie, "nimbus_session">;



// ───────────────────────────── Shared ─────────────────────────────

@doc("Opaque ID with a type prefix, e.g. `t_8f2k1`, `vm_02ab`, `task_9xq`.")
@minLength(3)
@maxLength(40)
scalar ResourceId extends string;

@doc("DNS-style slug: 3–63 chars, lowercase letters, digits, hyphens; starts and ends with a letter or digit.")
@minLength(3)
@maxLength(63)
@pattern("^[a-z0-9][a-z0-9-]*[a-z0-9]$")
scalar Slug extends string;

@doc("Machine-readable error codes. The UI shows the message for the code, filled from `params`; it never shows `title` or `detail` (SPEC.md §9, MSG-3).")
enum ErrorCode {
  UNAUTHENTICATED,
  FORBIDDEN,
  NOT_FOUND,
  VALIDATION_FAILED,
  TENANT_NAME_TAKEN,
  TENANT_NOT_ACTIVE,
  TENANT_NOT_SUSPENDED,
  TENANT_SUSPENDED,
  QUOTA_EXCEEDS_PLAN,
  QUOTA_BELOW_USAGE,
  QUOTA_EXCEEDED,
  VM_BUSY,
  VM_INVALID_STATE,
  BUCKET_NAME_TAKEN,
  BUCKET_NOT_EMPTY,
  RATE_LIMITED,
  INTERNAL,
}

model FieldError {
  @doc("JSON path of the invalid field, e.g. `name` or `quotas.storageQuotaBytes`.")
  field: string;

  message: string;
}

@doc("RFC 9457 problem details (API-2).")
model Problem {
  type?: url;
  title: string;
  status: int32;
  detail?: string;
  code: ErrorCode;

  @doc("Values for the code's message placeholders. QUOTA_EXCEEDS_PLAN and QUOTA_BELOW_USAGE carry `resource` (`\"storage\"` or `\"vms\"`), which selects the message; `max` / `used` are bytes for storage and a count for VMs. Example: `{ resource: \"storage\", plan: \"Starter\", max: 107374182400 }`.")
  params?: Record<string | int64 | boolean>;

  errors?: FieldError[];
}

@error
model Unauthorized {
  @statusCode _: 401;
  @header contentType: "application/problem+json";
  @body body: Problem;
}

@error
model Forbidden {
  @statusCode _: 403;
  @header contentType: "application/problem+json";
  @body body: Problem;
}

@error
model NotFound {
  @statusCode _: 404;
  @header contentType: "application/problem+json";
  @body body: Problem;
}

@error
model Conflict {
  @statusCode _: 409;
  @header contentType: "application/problem+json";
  @body body: Problem;
}

@error
model Unprocessable {
  @statusCode _: 422;
  @header contentType: "application/problem+json";
  @body body: Problem;
}

@error
model PayloadTooLarge {
  @statusCode _: 413;
  @header contentType: "application/problem+json";
  @body body: Problem;
}

@error
model RateLimited {
  @statusCode _: 429;
  @header contentType: "application/problem+json";
  @body body: Problem;
}

@error
model Internal {
  @statusCode _: 500;
  @header contentType: "application/problem+json";
  @body body: Problem;
}

alias AuthErrors = Unauthorized | Forbidden;

// Returned by any operation: invalid request (VALIDATION_FAILED), rate limit (RATE_LIMITED), server error (INTERNAL).
alias CommonErrors = Unprocessable | RateLimited | Internal;

@doc("Cursor pagination (API-3).")
model Page<T> {
  items: T[];

  @doc("Pass as `cursor` to get the next page. `null` on the last page.")
  nextCursor: string | null;

  @doc("Total matching items across all pages.")
  total: int32;
}

model PageQuery {
  @query
  @minValue(1)
  @maxValue(200)
  limit?: int32 = 50;

  @query cursor?: string;
}

// ───────────────────────────── Auth & session ─────────────────────────────

enum Role {
  provider_admin,
  reseller_admin,
  tenant_admin,
  tenant_viewer,
}

enum Permission {
  `tenant:read`,
  `tenant:create`,
  `tenant:update`,
  `tenant:suspend`,
  `quota:read`,
  `quota:update`,
  `vm:read`,
  `vm:operate`,
  `vm:create`,
  `bucket:read`,
  `bucket:create`,
  `bucket:delete`,
  `task:read`,
  `plan:read`,
  @doc("The Web Vitals summary (`/_vitals`, SPEC-SHL-5). Provider admins only (D9-04).")
  `vitals:read`,
}

model LoginRequest {
  @doc("Demo only: pick which seeded demo user to sign in as.")
  role: Role;
}

model User {
  id: ResourceId;
  name: string;
  @format("email") email: string;
}

@doc("Read-only summary of the user's own tenant (SPEC-SHL-8). Tenant roles have no `tenant:read`.")
model TenantSummary {
  id: ResourceId;
  displayName: string;
  planName: string;
  status: TenantStatus;
}

model Me {
  user: User;

  @doc("Shown in the UI for context only. Never use for authorization decisions (RBAC-1).")
  role: Role;

  @doc("Set for tenant_admin and tenant_viewer; null for provider/reseller admins.")
  tenant: TenantSummary | null;

  @doc("Set for reseller_admin.")
  resellerId: ResourceId | null;

  permissions: Permission[];
}

@route("/login")
@tag("Auth")
interface AuthApi {
  @doc("Demo sign-in. No credentials.")
  @useAuth(NoAuth)
  @post
  @operationId("login")
  @summary("Sign in as a demo user")
  login(@body body: LoginRequest): {
    @statusCode _: 200;

    @doc("`nimbus_session=<opaque>; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=<ttl>`")
    @header("Set-Cookie")
    setCookie: string;

    @body me: Me;
  } | Forbidden | CommonErrors;
}

@route("/logout")
@tag("Auth")
interface LogoutApi {
  @doc("Ends the session and clears the cookie.")
  @post
  @operationId("logout")
  @summary("Sign out")
  logout(): {
    @statusCode _: 204;

    @doc("Expires the `nimbus_session` cookie.")
    @header("Set-Cookie")
    setCookie: string;
  } | AuthErrors | CommonErrors;
}

@route("/me")
@tag("Auth")
interface MeApi {
  @operationId("getMe")
  @summary("Get current user and permissions")
  @get
  getMe(): Me | Unauthorized | CommonErrors;
}

// ───────────────────────────── Plans ─────────────────────────────

model Money {
  @doc("Amount in micro-units (1/1,000,000 of the currency unit). 0.035 EUR = 35000.")
  amountMicros: int64;

  @doc("ISO 4217 code.")
  currency: string;
}

model Plan {
  id: ResourceId;
  name: string;

  @doc("Maximum storage quota a tenant on this plan may have.")
  maxStorageQuotaBytes: int64;

  @doc("Maximum VM quota a tenant on this plan may have.")
  maxVmQuota: int32;

  defaultStorageQuotaBytes: int64;
  defaultVmQuota: int32;
  pricePerGiBMonth: Money;
  pricePerVcpuMonth: Money;
}

@route("/plans")
@tag("Plans")
interface PlansApi {
  @get
  @extension("x-permission", "plan:read")
  @operationId("listPlans")
  @summary("List plans")
  listPlans(): Plan[] | AuthErrors | CommonErrors;
}

// ───────────────────────────── Tenants ─────────────────────────────

enum TenantStatus {
  active,
  suspended,
  provisioning,
  error,
}

model Tenant {
  id: ResourceId;
  name: Slug;
  @maxLength(120) displayName: string;
  status: TenantStatus;
  planId: ResourceId;
  resellerId: ResourceId | null;
  @format("email") adminEmail: string;
  createdAt: utcDateTime;
  storageUsedBytes: int64;
  storageQuotaBytes: int64;
  vmCount: int32;
  vmQuota: int32;
}

model TenantCreate {
  name: Slug;
  @maxLength(120) displayName?: string;
  @format("email") adminEmail: string;
  planId: ResourceId;

  @doc("At least 1 GiB, at most the plan's maxStorageQuotaBytes (else QUOTA_EXCEEDS_PLAN).")
  @minValue(1073741824)
  storageQuotaBytes: int64;

  @minValue(1)
  @maxValue(500)
  vmQuota: int32;
}

model TenantUpdate {
  @maxLength(120) displayName?: string;
  @format("email") adminEmail?: string;

  @doc("Changing plan fails with QUOTA_EXCEEDS_PLAN if current quotas exceed the new plan's maximums.")
  planId?: ResourceId;
}

enum TenantSort {
  name: "name",
  nameDesc: "-name",
  createdAt: "createdAt",
  createdAtDesc: "-createdAt",
  storageUsed: "storageUsedBytes",
  storageUsedDesc: "-storageUsedBytes",
}

model TenantPage is Page<Tenant>;

model TenantQuotas {
  storageQuotaBytes: int64;
  storageUsedBytes: int64;
  vmQuota: int32;
  vmCount: int32;

  @doc("The plan's maximums, so the UI can validate before saving.")
  planMaxStorageQuotaBytes: int64;

  planMaxVmQuota: int32;
}

model QuotaUpdate {
  @doc("Must be ≥ storageUsedBytes (QUOTA_BELOW_USAGE) and ≤ plan max (QUOTA_EXCEEDS_PLAN).")
  @minValue(1073741824)
  storageQuotaBytes?: int64;

  @doc("Must be ≥ vmCount (QUOTA_BELOW_USAGE) and ≤ plan max (QUOTA_EXCEEDS_PLAN).")
  @minValue(1)
  @maxValue(500)
  vmQuota?: int32;
}

model TenantCreated {
  tenant: Tenant;

  @doc("The `tenant.provision` task (seq 0). The caller publishes `task:started` with it (SPEC.md §2.5).")
  task: Task;
}

model TaskAccepted {
  @statusCode _: 202;
  @body task: Task;
}

@route("/tenants")
@tag("Tenants")
interface TenantsApi {
  @doc("Scoped by the server: provider_admin sees all, reseller_admin sees own. Tenant roles have no `tenant:read` (403).")
  @get
  @extension("x-permission", "tenant:read")
  @operationId("listTenants")
  @summary("List tenants")
  listTenants(
    @query @maxLength(100) q?: string,
    @query status?: TenantStatus,
    @query planId?: ResourceId,
    @query sort?: TenantSort = TenantSort.name,
    ...PageQuery,
  ): TenantPage | AuthErrors | CommonErrors;

  @doc("Creates the tenant in `provisioning` status and starts a `tenant.provision` task, returned with it.")
  @post
  @extension("x-permission", "tenant:create")
  @operationId("createTenant")
  @summary("Create tenant")
  createTenant(@body body: TenantCreate): {
    @statusCode _: 201;
    @body created: TenantCreated;
  } | AuthErrors | Conflict | CommonErrors;

  @get
  @route("/{tenantId}")
  @extension("x-permission", "tenant:read")
  @operationId("getTenant")
  @summary("Get tenant")
  getTenant(@path tenantId: ResourceId): Tenant | AuthErrors | NotFound | CommonErrors;

  @patch(#{ implicitOptionality: false })
  @route("/{tenantId}")
  @extension("x-permission", "tenant:update")
  @operationId("updateTenant")
  @summary("Update tenant")
  updateTenant(@path tenantId: ResourceId, @body body: TenantUpdate): Tenant | AuthErrors | NotFound | CommonErrors;

  @doc("409 TENANT_NOT_ACTIVE if not active (the only use of that code).")
  @post
  @route("/{tenantId}/suspend")
  @extension("x-permission", "tenant:suspend")
  @operationId("suspendTenant")
  @summary("Suspend tenant")
  suspendTenant(@path tenantId: ResourceId): TaskAccepted | AuthErrors | NotFound | Conflict | CommonErrors;

  @doc("409 TENANT_NOT_SUSPENDED if not suspended.")
  @post
  @route("/{tenantId}/resume")
  @extension("x-permission", "tenant:suspend")
  @operationId("resumeTenant")
  @summary("Resume tenant")
  resumeTenant(@path tenantId: ResourceId): TaskAccepted | AuthErrors | NotFound | Conflict | CommonErrors;

  @get
  @route("/{tenantId}/quotas")
  @extension("x-permission", "quota:read")
  @operationId("getQuotas")
  @summary("Get tenant quotas and usage")
  getQuotas(@path tenantId: ResourceId): TenantQuotas | AuthErrors | NotFound | CommonErrors;

  @doc("422 QUOTA_BELOW_USAGE / QUOTA_EXCEEDS_PLAN (with `params.resource`); 409 TENANT_SUSPENDED if the tenant is suspended.")
  @put
  @route("/{tenantId}/quotas")
  @extension("x-permission", "quota:update")
  @operationId("updateQuotas")
  @summary("Update tenant quotas")
  updateQuotas(@path tenantId: ResourceId, @body body: QuotaUpdate): TenantQuotas | AuthErrors | NotFound | Conflict | CommonErrors;
}

// ───────────────────────────── Compute ─────────────────────────────

enum VmStatus {
  running,
  stopped,
  starting,
  stopping,
  rebooting,
  error,
}

enum VmAction {
  start,
  stop,
  reboot,
}

model Vm {
  id: ResourceId;
  tenantId: ResourceId;
  name: Slug;
  status: VmStatus;
  vcpus: int32;
  memoryMiB: int32;
  diskGiB: int32;
  ip: string | null;
  image: string;

  @doc("Set while an operation is running; all actions are blocked (VM_BUSY).")
  activeTaskId: ResourceId | null;

  createdAt: utcDateTime;
}

model VmPage is Page<Vm>;

model VmActionRequest {
  action: VmAction;
}

@route("/vms")
@tag("Compute")
interface VmsApi {
  @doc("VMs of the caller's tenant. Provider/reseller admins must pass tenantId (422 VALIDATION_FAILED without it); a tenantId outside the caller's scope returns 404 NOT_FOUND.")
  @get
  @extension("x-permission", "vm:read")
  @operationId("listVms")
  @summary("List virtual machines")
  listVms(
    @query tenantId?: ResourceId,
    @query status?: VmStatus,
    @query @maxLength(100) q?: string,
    ...PageQuery,
  ): VmPage | AuthErrors | NotFound | CommonErrors;

  @get
  @route("/{vmId}")
  @extension("x-permission", "vm:read")
  @operationId("getVm")
  @summary("Get virtual machine")
  getVm(@path vmId: ResourceId): Vm | AuthErrors | NotFound | CommonErrors;

  @doc("""
    Valid transitions: stopped→start, running→stop, running→reboot.
    409 VM_BUSY if an operation is already running; 409 VM_INVALID_STATE for invalid transitions;
    409 TENANT_SUSPENDED if the VM's tenant is suspended.
    """)
  @post
  @route("/{vmId}/actions")
  @extension("x-permission", "vm:operate")
  @operationId("runVmAction")
  @summary("Start, stop or reboot a VM")
  runVmAction(@path vmId: ResourceId, @body body: VmActionRequest): TaskAccepted | AuthErrors | NotFound | Conflict | CommonErrors;
}

// ───────────────────────────── Storage ─────────────────────────────

@doc("S3 bucket name: 3–63 chars, lowercase letters, digits, dots, hyphens; no `..`; not IP-formatted (checked server-side and in UI).")
@minLength(3)
@maxLength(63)
@pattern("^[a-z0-9][a-z0-9.-]*[a-z0-9]$")
scalar BucketName extends string;

model Bucket {
  name: BucketName;
  tenantId: ResourceId;
  createdAt: utcDateTime;
  sizeBytes: int64;
  objectCount: int32;
  versioning: boolean;
}

model BucketCreate {
  name: BucketName;
  versioning?: boolean = false;
}

model BucketPage is Page<Bucket>;

@route("/buckets")
@tag("Storage")
interface BucketsApi {
  @doc("Buckets of the caller's tenant. Provider/reseller admins must pass tenantId (422 VALIDATION_FAILED without it); a tenantId outside the caller's scope returns 404 NOT_FOUND.")
  @get
  @extension("x-permission", "bucket:read")
  @operationId("listBuckets")
  @summary("List buckets")
  listBuckets(
    @query tenantId?: ResourceId,
    @query @maxLength(63) q?: string,
    ...PageQuery,
  ): BucketPage | AuthErrors | NotFound | CommonErrors;

  @doc("409 BUCKET_NAME_TAKEN; 409 TENANT_SUSPENDED if the tenant is suspended; 422 VALIDATION_FAILED or QUOTA_EXCEEDED when storage quota is fully used.")
  @post
  @extension("x-permission", "bucket:create")
  @operationId("createBucket")
  @summary("Create bucket")
  createBucket(@body body: BucketCreate): {
    @statusCode _: 201;
    @body bucket: Bucket;
  } | AuthErrors | Conflict | CommonErrors;

  @doc("Only empty buckets can be deleted (409 BUCKET_NOT_EMPTY); 409 TENANT_SUSPENDED if the tenant is suspended.")
  @delete
  @route("/{bucketName}")
  @extension("x-permission", "bucket:delete")
  @operationId("deleteBucket")
  @summary("Delete bucket")
  deleteBucket(@path bucketName: BucketName): {
    @statusCode _: 204;
  } | AuthErrors | NotFound | Conflict | CommonErrors;
}

// ───────────────────────────── Tasks ─────────────────────────────

enum TaskKind {
  `vm.start`,
  `vm.stop`,
  `vm.reboot`,
  `tenant.suspend`,
  `tenant.resume`,
  `tenant.provision`,
}

enum TaskStatus {
  queued,
  running,
  succeeded,
  failed,
}

enum ResourceType {
  vm,
  tenant,
  bucket,
}

model ResourceRef {
  type: ResourceType;
  id: ResourceId;
  name: string;
}

model Task {
  id: ResourceId;
  kind: TaskKind;
  status: TaskStatus;

  @minValue(0)
  @maxValue(100)
  progress: int32;

  @doc("Per-task version, increased on every change; 0 in the 201/202 response. Clients merge with `mergeTask` (SPEC.md §2.5).")
  @minValue(0)
  seq: int32;

  resource: ResourceRef;
  tenantId: ResourceId | null;
  error: Problem | null;
  createdAt: utcDateTime;
  finishedAt: utcDateTime | null;
}

model TaskPage is Page<Task>;

@route("/tasks")
@tag("Tasks")
interface TasksApi {
  @doc("Tasks visible to the caller, newest first.")
  @get
  @extension("x-permission", "task:read")
  @operationId("listTasks")
  @summary("List tasks")
  listTasks(
    @query status?: TaskStatus,
    @query resourceId?: ResourceId,
    @doc("Only tasks created after this time.") @query since?: utcDateTime,
    ...PageQuery,
  ): TaskPage | AuthErrors | CommonErrors;

  @get
  @route("/{taskId}")
  @extension("x-permission", "task:read")
  @operationId("getTask")
  @summary("Get task")
  getTask(@path taskId: ResourceId): Task | AuthErrors | NotFound | CommonErrors;
}

// ───────────────────────────── Realtime events ─────────────────────────────

model TaskUpdatedEvent {
  type: "task.updated";
  task: Task;
}

model VmUpdatedEvent {
  type: "vm.updated";
  vm: {
    id: ResourceId;
    status: VmStatus;
    ip: string | null;
    activeTaskId: ResourceId | null;
  };
}

model TenantUpdatedEvent {
  type: "tenant.updated";
  tenant: {
    id: ResourceId;
    status: TenantStatus;
  };
}

model QuotaUpdatedEvent {
  type: "quota.updated";
  tenantId: ResourceId;
  quotas: TenantQuotas;
}

model BucketUpdatedEvent {
  type: "bucket.updated";
  tenantId: ResourceId;

  @doc("`null` when the bucket was deleted.")
  bucket: Bucket | null;

  name: BucketName;
}

model HeartbeatEvent {
  type: "heartbeat";
  ts: utcDateTime;
}

@doc("Server → client WebSocket message. Discriminated by `type`.")
union ServerEvent {
  task: TaskUpdatedEvent,
  vm: VmUpdatedEvent,
  tenant: TenantUpdatedEvent,
  quota: QuotaUpdatedEvent,
  bucket: BucketUpdatedEvent,
  heartbeat: HeartbeatEvent,
}

@route("/events")
@tag("Realtime")
interface EventsApi {
  @doc("""
    WebSocket endpoint: connect to ws(s)://<host>/api/events. The browser sends the session cookie
    on the handshake; the server rejects handshakes without a valid session (401) or with a
    foreign `Origin` (403). A session only receives events about resources it can read (RT-12).
    Close codes are listed in `x-close-codes` (WS-5).
    This HTTP description exists only so the message schema (ServerEvent) is part of the contract
    and gets generated types + Zod validation. Clients must not call it over plain HTTP.
    """)
  @get
  @extension("x-permission", "task:read")
  @extension("x-transport", "websocket")
  @extension("x-close-codes", #{
    `4401`: "Session missing, expired or signed out. Don't reconnect; go to /login?reason=expired.",
    `4403`: "Origin rejected. Don't reconnect; state offline.",
    `4429`: "Too many connections. Reconnect with backoff, minimum 30 s.",
    `1000`: "Normal close. Reconnect with backoff (WS-1).",
    `1001`: "Server going away. Reconnect with backoff (WS-1).",
    `1006`: "Network failure or HTTP 401 at the handshake. Call GET /api/me: 401 → as 4401; otherwise reconnect with backoff.",
  })
  @operationId("events")
  @summary("Realtime event stream (WebSocket)")
  events(): ServerEvent | AuthErrors | CommonErrors;
}

// ───────────────────────────── RUM ─────────────────────────────

enum VitalName {
  LCP,
  INP,
  CLS,
  FCP,
  TTFB,
}

enum VitalRating {
  good: "good",
  needsImprovement: "needs-improvement",
  poor: "poor",
}

model VitalRecord {
  metric: VitalName;
  value: float64;
  rating: VitalRating;
  @doc("The route template, never the URL: `/tenants/:tenantId`, `/compute/:vmId`, `/storage`; no IDs and no query string (D9-04).")
  route: string;

  @doc("Remote that owned the route, or `shell`.")
  remote: string;

  navigationType: string;
  ts: utcDateTime;
}

model VitalSummary {
  route: string;
  metric: VitalName;
  p75: float64;
  rating: VitalRating;
  samples: int32;
}

@route("/rum")
@tag("RUM")
interface RumApi {
  @doc("Sent with navigator.sendBeacon; no auth so it works during page unload. The only mutating operation exempt from `X-Nimbus-Csrf` (NFR-SEC-6): unauthenticated, append-only, `Origin`-checked, rate-limited to 60 requests/min per client IP (429), body limited to 16 KB (413), schema-validated (422); a foreign `Origin` gets 403.")
  @useAuth(NoAuth)
  @post
  @operationId("reportVitals")
  @summary("Report Web Vitals")
  reportVitals(@body records: VitalRecord[]): {
    @statusCode _: 204;
  } | Forbidden | PayloadTooLarge | CommonErrors;

  @get
  @route("/summary")
  @extension("x-permission", "vitals:read")
  @operationId("getVitalsSummary")
  @summary("Get Web Vitals p75 summary")
  getVitalsSummary(): VitalSummary[] | AuthErrors | CommonErrors;
}
