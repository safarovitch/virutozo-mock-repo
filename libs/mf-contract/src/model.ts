// Contract models used by the MF contract and the bus catalogue, re-exported as types only (F11).
// They come from the generated client, so the snapshot and bus payloads change when the contract changes.
// Type-only on purpose: libs/mf-contract has no runtime dependency on the API client (eslint.config.mjs).
export type {
  Bucket,
  Permission,
  Role,
  Task,
  TaskStatus,
  Tenant,
  TenantQuotas,
  TenantStatus,
  TenantSummary,
  Vm,
  VmStatus,
} from '@nimbus/api-client/model';
