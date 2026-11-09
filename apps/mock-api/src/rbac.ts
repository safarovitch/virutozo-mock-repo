// Permissions per role (specs/shared/rbac.md matrix) and server-side scope (all / own / own tenant).
import type { Permission, Role, Tenant } from '@nimbus/api-client/model';
import type { DemoUser } from './db';

export const PERMISSIONS: Record<Role, Permission[]> = {
  provider_admin: ['tenant:read', 'tenant:create', 'tenant:update', 'tenant:suspend', 'quota:read', 'quota:update', 'vm:read', 'vm:operate', 'bucket:read', 'task:read', 'plan:read', 'vitals:read'],
  reseller_admin: ['tenant:read', 'tenant:create', 'tenant:update', 'quota:read', 'quota:update', 'vm:read', 'bucket:read', 'task:read', 'plan:read'],
  tenant_admin: ['quota:read', 'vm:read', 'vm:operate', 'vm:create', 'bucket:read', 'bucket:create', 'bucket:delete', 'task:read'],
  tenant_viewer: ['quota:read', 'vm:read', 'bucket:read', 'task:read'],
};

/** Can this user see data of this tenant at all? Providers: all; resellers: own tenants; tenant roles: own tenant. */
export function inScope(user: DemoUser, tenant: Pick<Tenant, 'id' | 'resellerId'> | undefined): boolean {
  if (!tenant) return false;
  if (user.role === 'provider_admin') return true;
  if (user.role === 'reseller_admin') return tenant.resellerId === user.resellerId;
  return tenant.id === user.tenantId;
}

export const isTenantRole = (user: DemoUser) => user.tenantId !== null;
