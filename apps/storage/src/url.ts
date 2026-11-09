// URL state of the storage area (SPEC-STO-3, D8-16, specs/shared/url-conventions.md): the same rules as
// compute. `ctx.path` is the part below `/storage`, e.g. "/?tenantId=t_acme".

// Contract ResourceId: 3–40 characters with a type prefix (t_acme).
export const isResourceId = (value: string) => value.length >= 3 && value.length <= 40 && /^[a-z]+_[a-z0-9_]+$/.test(value);

export interface StorageUrl {
  /** Only for admins; dropped for tenant roles and when the format is wrong. */
  tenantId?: string;
  /** Parameters this area doesn't own; kept as they are. */
  other: [string, string][];
  /** The URL had a `tenantId` (or a path below /storage) that had to be dropped: replace it with `toPath(...)`. */
  needsCorrection: boolean;
}

/** `admin`: the session has no own tenant (`session.tenant === null`), so `tenantId` picks one. */
export function parsePath(path: string, admin: boolean): StorageUrl {
  const url = new URL(path, 'http://x');
  let tenantId: string | undefined;
  let needsCorrection = url.pathname.split('/').some(Boolean); // Storage has no sub-pages
  const other: [string, string][] = [];
  for (const [key, value] of url.searchParams) {
    if (key !== 'tenantId') other.push([key, value]);
    else if (admin && isResourceId(value) && !tenantId) tenantId = value;
    else needsCorrection = true; // tenant roles: removed; admins: an invalid ID is treated as missing
  }
  return { ...(tenantId ? { tenantId } : {}), other, needsCorrection };
}

/** The path below the base path for this state, in a stable parameter order. */
export function toPath(state: { tenantId?: string | undefined; other?: [string, string][] }): string {
  const params = new URLSearchParams();
  if (state.tenantId) params.set('tenantId', state.tenantId);
  for (const [key, value] of state.other ?? []) params.append(key, value);
  const search = params.toString();
  return `/${search ? `?${search}` : ''}`;
}
