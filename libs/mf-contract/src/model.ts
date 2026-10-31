// TODO(TECH-2): replace with @nimbus/api-client/model.
// Minimal hand-made copies of the contract models that the MF contract and the bus catalogue need
// (D1-01). They follow contracts/main.tsp; TECH-2 swaps them for `import type` from the generated models.

export type Role = 'provider_admin' | 'reseller_admin' | 'tenant_admin' | 'tenant_viewer';

export type Permission =
  | 'tenant:read'
  | 'tenant:create'
  | 'tenant:update'
  | 'tenant:suspend'
  | 'quota:read'
  | 'quota:update'
  | 'vm:read'
  | 'vm:operate'
  | 'vm:create'
  | 'bucket:read'
  | 'bucket:create'
  | 'bucket:delete'
  | 'task:read'
  | 'plan:read';

export type TenantStatus = 'active' | 'suspended' | 'provisioning' | 'error';

export interface TenantSummary {
  id: string;
  displayName: string;
  planName: string;
  status: TenantStatus;
}

export interface Tenant {
  id: string;
  name: string;
  displayName: string;
  status: TenantStatus;
}

export type VmStatus = 'running' | 'stopped' | 'starting' | 'stopping' | 'rebooting' | 'error';

export interface Vm {
  id: string;
  tenantId: string;
  name: string;
  status: VmStatus;
  ip: string | null;
  activeTaskId: string | null;
}

export interface TenantQuotas {
  storageQuotaBytes: number;
  storageUsedBytes: number;
  vmQuota: number;
  vmCount: number;
  planMaxStorageQuotaBytes: number;
  planMaxVmQuota: number;
}

export interface Bucket {
  name: string;
  tenantId: string;
  createdAt: string;
  sizeBytes: number;
  objectCount: number;
  versioning: boolean;
}

export type TaskStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface Task {
  id: string;
  kind: string;
  status: TaskStatus;
  progress: number;
  seq: number;
  resource: { type: 'vm' | 'tenant' | 'bucket'; id: string; name: string };
  tenantId: string | null;
  error: { code: string; title: string; status: number } | null;
  createdAt: string;
  finishedAt: string | null;
}
