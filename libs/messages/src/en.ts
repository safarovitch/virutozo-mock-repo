// Shared message catalogue (MSG-1): errors, statuses, connection states, common actions.
// Wording source: specs/mock-data.md §9 (errors) and §10 (other UI messages). Area strings live in
// apps/<area>/src/messages/en.ts. Placeholders `{name}` are filled as text, never HTML (MSG-2).
export const en = {
  // ── Errors by Problem.code (mock-data §9) ──
  'errors.UNAUTHENTICATED': 'Your session expired. Please sign in again.',
  'errors.FORBIDDEN': "You don't have permission to do this.",
  'errors.NOT_FOUND': 'This item no longer exists.',
  'errors.VALIDATION_FAILED': 'Some fields need attention.',
  'errors.TENANT_NAME_TAKEN': 'This name is already taken.',
  'errors.TENANT_NOT_ACTIVE': 'Only active tenants can be suspended.',
  'errors.TENANT_SUSPENDED': 'This tenant is suspended, so changes are disabled.',
  'errors.TENANT_NOT_SUSPENDED': 'Only suspended tenants can be resumed.',
  'errors.QUOTA_EXCEEDS_PLAN.storage': '{plan} allows up to {max}.',
  'errors.QUOTA_EXCEEDS_PLAN.vms': '{plan} allows up to {max} VMs.',
  'errors.QUOTA_BELOW_USAGE.storage': "Storage quota can't be lower than current usage ({used}).",
  'errors.QUOTA_BELOW_USAGE.vms': "VM quota can't be lower than the current number of VMs ({used}).",
  'errors.QUOTA_EXCEEDED': 'Storage quota is full. Free up space or ask an admin to raise the quota.',
  'errors.VM_BUSY': '{name} is busy with another operation.',
  'errors.VM_INVALID_STATE': "{name} can't {action} while it's {status}.",
  'errors.BUCKET_NAME_TAKEN': 'A bucket with this name already exists.',
  'errors.BUCKET_NOT_EMPTY': 'Empty the bucket before deleting it.',
  'errors.RATE_LIMITED': 'Too many requests. Try again in a moment.',
  'errors.INTERNAL': 'Something went wrong on our side. Try again.',

  // ── Tenant status (mock-data §10) ──
  'tenantStatus.suspendedBanner': "This tenant is suspended. You can view resources but can't change them.", // draft
  'tenantStatus.suspendedAdminBanner': '{tenant} is suspended. Resume it to make changes.',
  'tenantStatus.suspendedTooltip': 'Changes are disabled while this tenant is suspended.',
  'status.tenant.active': 'Active', // draft
  'status.tenant.suspended': 'Suspended', // draft
  'status.tenant.provisioning': 'Provisioning', // draft
  'status.tenant.error': 'Error', // draft

  // ── Connection (WS-4, WS-7) ──
  'connections.label': 'Connection',
  'connections.connecting': 'Connecting…', // draft
  'connections.connected': 'Connected',
  'connections.reconnecting': 'Reconnecting…',
  'connections.offline': 'Offline',

  // ── Permissions (RBAC-4) ──
  'rbac.disabledTooltip': "You don't have permission to {action}.",
  'actions.createTenant': 'create tenants',
  'actions.suspendTenant': 'suspend tenants',
  'actions.resumeTenant': 'resume tenants',
  'actions.updateQuota': 'change quotas',
  'actions.operateVm': 'start, stop or reboot VMs',
  'actions.createBucket': 'create buckets',
  'actions.deleteBucket': 'delete buckets',

  // ── Areas ──
  'areas.tenants': 'Tenants',
  'areas.storage': 'Storage',
  'areas.compute': 'Compute',
} as const;

export type MessageKey = keyof typeof en;
