import { describe, expect, it } from 'vitest';
import type { Permission, ResourceRef } from '@nimbus/api-client/model';
import type { SessionSnapshot } from '@nimbus/mf-contract';
import { canOpen } from './index';

const user = { id: 'u_1', name: 'U', email: 'u@example.com' };
const acme = { id: 't_acme', displayName: 'Acme Corporation', planName: 'Business', status: 'active' } as const;
// Permissions from specs/shared/rbac.md.
const provider: SessionSnapshot = { user, role: 'provider_admin', tenant: null, permissions: ['tenant:read', 'vm:read', 'bucket:read', 'task:read'] as Permission[] };
const tenantAdmin: SessionSnapshot = { user, role: 'tenant_admin', tenant: acme, permissions: ['quota:read', 'vm:read', 'bucket:read', 'task:read'] as Permission[] };
const target = (type: ResourceRef['type'], id: string, tenantId: string | null = 't_acme') => ({ resource: { type, id, name: id }, tenantId });

describe('canOpen', () => {
  it('AC-TSK-1.6: for tenant roles a tenant task (tenant.provision on acme) has no link', () => {
    expect(canOpen(target('tenant', 't_acme'), tenantAdmin)).toBeNull();
  });

  it('AC-TSK-1.7: a VM task links to the VM; admins without a tenant context get ?tenantId', () => {
    expect(canOpen(target('vm', 'vm_01'), tenantAdmin)).toBe('/compute/vm_01');
    expect(canOpen(target('vm', 'vm_01'), provider)).toBe('/compute/vm_01?tenantId=t_acme');
  });

  it('TECH-4: tenant tasks link for tenant:read, buckets never link, missing permissions give null', () => {
    expect(canOpen(target('tenant', 't_acme'), provider)).toBe('/tenants/t_acme');
    expect(canOpen(target('bucket', 'acme-logs'), provider)).toBeNull();
    expect(canOpen(target('vm', 'vm_01'), { ...tenantAdmin, permissions: [] })).toBeNull();
  });
});
