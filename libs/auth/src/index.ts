// Framework-agnostic permission helpers (specs/shared/rbac.md). Pure, no I/O.
// RBAC-1: decisions use permissions only, never role names.
import { Permission, type ResourceRef } from '@nimbus/api-client/model';
import type { SessionSnapshot } from '@nimbus/mf-contract';

export type AreaName = 'tenants' | 'compute' | 'storage';

/** Areas in sidebar and home-area order (SPEC-SHL-1, SPEC-SHL-2) with the `*:read` permission that shows them (RBAC-3). */
export const AREAS: readonly { readonly name: AreaName; readonly permission: Permission }[] = [
  { name: 'tenants', permission: Permission['tenant:read'] },
  { name: 'compute', permission: Permission['vm:read'] },
  { name: 'storage', permission: Permission['bucket:read'] },
];

export function can(session: Pick<SessionSnapshot, 'permissions'> | null, permission: Permission): boolean {
  return session?.permissions.includes(permission) ?? false;
}

/** Areas the session may open, in sidebar order. */
export function permittedAreas(session: Pick<SessionSnapshot, 'permissions'> | null): AreaName[] {
  return AREAS.filter((a) => can(session, a.permission)).map((a) => a.name);
}

/** The first permitted area (SPEC-SHL-1), or null when there is none (D3-09). */
export function homeArea(session: Pick<SessionSnapshot, 'permissions'> | null): AreaName | null {
  return permittedAreas(session)[0] ?? null;
}

/** The permission an app path needs, or null for paths outside the areas. */
export function permissionForPath(pathname: string): Permission | null {
  const first = pathname.split('/')[1];
  return AREAS.find((a) => a.name === first)?.permission ?? null;
}

const isLoginPath = (pathname: string) => pathname === '/login' || pathname.startsWith('/login/');

/**
 * Validates `?returnTo=` (SPEC-SHL-1, AC-SHL-1.8): valid only when it resolves to the app's own origin.
 * Returns `pathname + search + hash` to navigate to, or null. `/` and `/login` targets return null (D3-08).
 */
export function safeReturnTo(returnTo: string | null | undefined, origin: string): string | null {
  if (!returnTo) return null;
  let url: URL;
  try {
    url = new URL(returnTo, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  if (url.pathname === '/' || isLoginPath(url.pathname)) return null;
  return url.pathname + url.search + url.hash;
}

/** The `returnTo` value for the current location: path + query + hash, or null for `/` and `/login` (D3-08). */
export function returnToFor(location: { pathname: string; search: string; hash: string }): string | null {
  if (location.pathname === '/' || isLoginPath(location.pathname)) return null;
  return location.pathname + location.search + location.hash;
}

/** `/login`, with `reason=expired` and `returnTo` when given (SPEC-SHL-1). */
export function loginUrl(options: { returnTo?: string | null; expired?: boolean } = {}): string {
  const params = new URLSearchParams();
  if (options.expired) params.set('reason', 'expired');
  if (options.returnTo) params.set('returnTo', options.returnTo);
  const query = params.toString();
  return query ? `/login?${query}` : '/login';
}

/**
 * Where a task's *View resource* link goes, or null to render the resource name as plain text (SPEC-TSK-1).
 * No scope check: the server only sends tasks the user may see (RT-12); a stale link ends in "no longer exists".
 */
export function canOpen(target: { resource: ResourceRef; tenantId: string | null }, session: SessionSnapshot): string | null {
  const id = encodeURIComponent(target.resource.id);
  switch (target.resource.type) {
    case 'tenant':
      return can(session, Permission['tenant:read']) ? `/tenants/${id}` : null;
    case 'vm': {
      if (!can(session, Permission['vm:read'])) return null;
      const tenant = session.tenant === null && target.tenantId ? `?tenantId=${encodeURIComponent(target.tenantId)}` : '';
      return `/compute/${id}${tenant}`;
    }
    default:
      return null; // buckets have no route
  }
}
