// URL state of the compute area (SPEC-CMP-5, SPEC-CMP-4, specs/shared/url-conventions.md).
// `ctx.path` is the part below `/compute`, e.g. "/vm_01?tenantId=t_acme".

// Contract ResourceId: 3–40 characters with a type prefix (vm_01, t_acme).
export const isResourceId = (value: string) => value.length >= 3 && value.length <= 40 && /^[a-z]+_[a-z0-9_]+$/.test(value);

export interface ComputeUrl {
  /** The path segment, as written (the drawer shows "not found" for one that isn't a valid ID). */
  vmId?: string;
  /** Only for admins; dropped for tenant roles and when the format is wrong. */
  tenantId?: string;
  /** Parameters this area doesn't own; kept as they are (url-conventions). */
  other: [string, string][];
  /** The URL had a `tenantId` that had to be dropped: the caller replaces it with `toPath(...)`. */
  needsCorrection: boolean;
}

/** `admin`: the session has no own tenant (`session.tenant === null`), so `tenantId` picks one. */
export function parsePath(path: string, admin: boolean): ComputeUrl {
  const url = new URL(path, 'http://x');
  const vmId = url.pathname.split('/').filter(Boolean)[0];
  let tenantId: string | undefined;
  let needsCorrection = false;
  const other: [string, string][] = [];
  for (const [key, value] of url.searchParams) {
    if (key !== 'tenantId') other.push([key, value]);
    else if (admin && isResourceId(value) && !tenantId) tenantId = value;
    else needsCorrection = true; // tenant roles: ignored and removed; admins: an invalid ID is treated as missing
  }
  return { vmId: vmId ? decodeURIComponent(vmId) : undefined, tenantId, other, needsCorrection };
}

/** The path below the base path for this state, in a stable parameter order. */
export function toPath(state: { vmId?: string; tenantId?: string; other?: [string, string][] }): string {
  const params = new URLSearchParams();
  if (state.tenantId) params.set('tenantId', state.tenantId);
  for (const [key, value] of state.other ?? []) params.append(key, value);
  const search = params.toString();
  return `/${state.vmId ? encodeURIComponent(state.vmId) : ''}${search ? `?${search}` : ''}`;
}
