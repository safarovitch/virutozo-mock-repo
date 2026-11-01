// URL state of the tenants area (SPEC-TEN-1, SPEC-TEN-3, specs/shared/url-conventions.md).
// `ctx.path` is the part below `/tenants`, e.g. "/t_acme?status=active&tab=quotas".
import { TenantSort, TenantStatus, type ListTenantsParams } from '@nimbus/api-client/model';

export const PAGE_SIZE = 100; // SPEC-TEN-1
export const DEFAULT_SORT: TenantSort = TenantSort.name;
export const TABS = ['overview', 'quotas', 'activity'] as const;
export type Tab = (typeof TABS)[number];

// Contract ResourceId: 3–40 characters with a type prefix (t_acme, p_business).
const isResourceId = (value: string) => value.length >= 3 && value.length <= 40 && /^[a-z]+_[a-z0-9_]+$/.test(value);
const STATUSES = new Set<string>(Object.values(TenantStatus));
const SORTS = new Set<string>(Object.values(TenantSort));

export interface ListState {
  q?: string;
  status?: TenantStatus;
  planId?: string;
  sort: TenantSort;
}

export interface TenantsUrl {
  list: ListState;
  tenantId?: string;
  tab: Tab;
  /** Parameters this area doesn't own; kept as they are (url-conventions). */
  other: [string, string][];
  /** The URL had a value that had to be dropped: the caller replaces it with `toPath(...)` (D5-06, AC-TEN-3.13). */
  needsCorrection: boolean;
}

/** Parses `ctx.path`. Invalid values are dropped and flagged, never guessed. `planIds` checks the plan once plans are loaded. */
export function parsePath(path: string, planIds?: ReadonlySet<string>): TenantsUrl {
  const url = new URL(path, 'http://x');
  const segment = url.pathname.split('/').filter(Boolean)[0];
  let needsCorrection = false;
  const list: ListState = { sort: DEFAULT_SORT };
  let tab: Tab = 'overview';
  const other: [string, string][] = [];

  for (const [key, value] of url.searchParams) {
    if (key === 'q') {
      const q = value.trim().slice(0, 100);
      if (q) list.q = q;
      else needsCorrection = true;
    } else if (key === 'status') {
      if (STATUSES.has(value)) list.status = value as TenantStatus;
      else needsCorrection = true;
    } else if (key === 'planId') {
      if (isResourceId(value) && (!planIds || planIds.has(value))) list.planId = value;
      else needsCorrection = true;
    } else if (key === 'sort') {
      if (SORTS.has(value) && value !== DEFAULT_SORT) list.sort = value as TenantSort;
      else needsCorrection = true; // invalid, or the default spelled out
    } else if (key === 'tab') {
      if (segment && (TABS as readonly string[]).includes(value) && value !== 'overview') tab = value as Tab;
      else needsCorrection = true; // bogus, default, or a tab without a drawer
    } else {
      other.push([key, value]);
    }
  }
  const tenantId = segment && isResourceId(segment) ? segment : undefined;
  if (segment && !tenantId) needsCorrection = true;
  return { list, tenantId, tab, other, needsCorrection };
}

/** The path below the base path for this state, in a stable parameter order. */
export function toPath(state: { list: ListState; tenantId?: string; tab?: Tab; other?: [string, string][] }): string {
  const params = new URLSearchParams();
  if (state.list.q) params.set('q', state.list.q);
  if (state.list.status) params.set('status', state.list.status);
  if (state.list.planId) params.set('planId', state.list.planId);
  if (state.list.sort !== DEFAULT_SORT) params.set('sort', state.list.sort);
  if (state.tenantId && state.tab && state.tab !== 'overview') params.set('tab', state.tab);
  for (const [key, value] of state.other ?? []) params.append(key, value);
  const search = params.toString();
  return `/${state.tenantId ?? ''}${search ? `?${search}` : ''}`;
}

/** `listTenants` parameters for a list state (no cursor: pages are added by the infinite query). */
export function listParams(list: ListState): ListTenantsParams {
  return {
    ...(list.q ? { q: list.q } : {}),
    ...(list.status ? { status: list.status } : {}),
    ...(list.planId ? { planId: list.planId } : {}),
    sort: list.sort,
    limit: PAGE_SIZE,
  };
}

export const hasFilters = (list: ListState) => Boolean(list.q || list.status || list.planId);

// ── Sorting (D5-01): column id ↔ TenantSort ──
export type SortColumn = 'name' | 'createdAt' | 'storageUsedBytes';

export function sortToColumn(sort: TenantSort): { id: SortColumn; desc: boolean } {
  const desc = sort.startsWith('-');
  return { id: (desc ? sort.slice(1) : sort) as SortColumn, desc };
}

export function columnToSort(id: SortColumn, desc: boolean): TenantSort {
  return `${desc ? '-' : ''}${id}` as TenantSort;
}
