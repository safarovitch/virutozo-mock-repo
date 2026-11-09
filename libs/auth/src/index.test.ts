import { describe, expect, it } from 'vitest';
import { Permission, type Role } from '@nimbus/api-client/model';
import type { SessionSnapshot } from '@nimbus/mf-contract';
import { can, homeArea, loginUrl, permissionForPath, permittedAreas, returnToFor, safeReturnTo } from './index';

const ORIGIN = 'http://localhost:8080';

// Permissions per role, from specs/shared/rbac.md (the mock-api returns the same from GET /me).
const PERMISSIONS: Record<Role, Permission[]> = {
  provider_admin: ['tenant:read', 'tenant:create', 'tenant:update', 'tenant:suspend', 'quota:read', 'quota:update', 'vm:read', 'vm:operate', 'bucket:read', 'task:read', 'plan:read'],
  reseller_admin: ['tenant:read', 'tenant:create', 'tenant:update', 'quota:read', 'quota:update', 'vm:read', 'bucket:read', 'task:read', 'plan:read'],
  tenant_admin: ['quota:read', 'vm:read', 'vm:operate', 'vm:create', 'bucket:read', 'bucket:create', 'bucket:delete', 'task:read'],
  tenant_viewer: ['quota:read', 'vm:read', 'bucket:read', 'task:read'],
};
const session = (role: Role): Pick<SessionSnapshot, 'permissions'> => ({ permissions: PERMISSIONS[role] });

describe('can / permittedAreas / homeArea', () => {
  it('RBAC-1: decides on permissions, not roles', () => {
    expect(can(session('tenant_admin'), Permission['vm:operate'])).toBe(true);
    expect(can(session('tenant_viewer'), Permission['vm:operate'])).toBe(false);
    expect(can(null, Permission['vm:read'])).toBe(false);
  });

  it('AC-SHL-2.1: a tenant_admin is offered Compute and Storage, not Tenants', () => {
    expect(permittedAreas(session('tenant_admin'))).toEqual(['compute', 'storage']);
  });

  it('RBAC-3: areas follow sidebar order Tenants → Compute → Storage for admins', () => {
    expect(permittedAreas(session('provider_admin'))).toEqual(['tenants', 'compute', 'storage']);
  });

  it('AC-SHL-1.1: the home area of a tenant_viewer is compute', () => {
    expect(homeArea(session('tenant_viewer'))).toBe('compute');
  });

  it('AC-SHL-1.2: the home area of provider and reseller admins is tenants', () => {
    expect(homeArea(session('provider_admin'))).toBe('tenants');
    expect(homeArea(session('reseller_admin'))).toBe('tenants');
  });

  it('AC-SHL-1.5: tenant roles get compute as home', () => {
    expect(homeArea(session('tenant_admin'))).toBe('compute');
  });

  it('AC-SHL-3.1: /tenants needs tenant:read; other paths need nothing', () => {
    expect(permissionForPath('/tenants/t_acme')).toBe('tenant:read');
    expect(permissionForPath('/compute')).toBe('vm:read');
    expect(permissionForPath('/storage/x')).toBe('bucket:read');
    expect(permissionForPath('/unknown')).toBeNull();
  });

  it('RBAC-5: a session without any area has no home (D3-09)', () => {
    expect(homeArea({ permissions: ['task:read'] })).toBeNull();
  });
});

describe('safeReturnTo', () => {
  it('AC-SHL-1.7: keeps path and query of a same-origin target', () => {
    expect(safeReturnTo('/tenants/t_acme?status=active', ORIGIN)).toBe('/tenants/t_acme?status=active');
  });

  it('AC-SHL-1.8: accepts /tenants?status=active and rejects other origins and schemes', () => {
    expect(safeReturnTo('/tenants?status=active', ORIGIN)).toBe('/tenants?status=active');
    for (const bad of ['//evil.example', '/\\evil.example', 'https://evil.example/x', 'javascript:alert(1)']) {
      expect(safeReturnTo(bad, ORIGIN), bad).toBeNull();
    }
  });

  it('AC-SHL-1.8: an encoded //evil.example stays on the app origin as a literal path', () => {
    expect(safeReturnTo('/%2F%2Fevil.example', ORIGIN)).toBe('/%2F%2Fevil.example');
  });

  it('AC-SHL-1.8: missing, root and /login targets fall back to the home area (D3-08)', () => {
    expect(safeReturnTo(null, ORIGIN)).toBeNull();
    expect(safeReturnTo('', ORIGIN)).toBeNull();
    expect(safeReturnTo('/', ORIGIN)).toBeNull();
    expect(safeReturnTo('/login?returnTo=/x', ORIGIN)).toBeNull();
  });
});

describe('returnToFor / loginUrl', () => {
  it('AC-SHL-1.4: returnTo is the current path with query and hash', () => {
    expect(returnToFor({ pathname: '/tenants/t_acme', search: '?tab=quotas', hash: '#x' })).toBe('/tenants/t_acme?tab=quotas#x');
    expect(returnToFor({ pathname: '/', search: '', hash: '' })).toBeNull();
    expect(returnToFor({ pathname: '/login', search: '?reason=expired', hash: '' })).toBeNull();
  });

  it('AC-SHL-1.4: the expiry URL carries reason=expired and an encoded returnTo', () => {
    expect(loginUrl({ expired: true, returnTo: '/compute?x=1' })).toBe('/login?reason=expired&returnTo=%2Fcompute%3Fx%3D1');
    expect(loginUrl()).toBe('/login');
  });
});
