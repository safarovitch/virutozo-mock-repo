// The storage area's server state (RT-4): its own QueryClient, keys only from Orval's helpers.
// Every write to the bucket lists goes through `upsertBucket` / `removeBucket`, so events and the
// mutation responses apply the same idempotent patch (D8-11).
import { useEffect } from 'react';
import { MutationCache, QueryClient, useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { ApiError, messageFor } from '@nimbus/api-client';
import type { Bucket, BucketCreate, BucketPage, ListBucketsParams, Problem, Tenant, TenantPage, TenantQuotas, TenantStatus } from '@nimbus/api-client/model';
import {
  createBucket,
  deleteBucket,
  getGetQuotasQueryKey,
  getGetTenantQueryKey,
  getListBucketsQueryKey,
  getListTenantsQueryKey,
  getQuotas,
  getTenant,
  listBuckets,
  listTenants,
} from '@nimbus/api-client/react';
import type { ScopedBus } from '@nimbus/mf-contract';
import { t } from './messages/en';

type BucketPages = InfiniteData<BucketPage, string | undefined>;

/** `acme` has 15 buckets; more pages load with *Load more* (D8-11). */
export const PAGE_SIZE = 100;
export const PICKER_LIMIT = 20;

/** One per mount (MF-2). A refused mutation (403) shows `errors.FORBIDDEN` through the shell's toasts. */
export function createStorageQueryClient(events: ScopedBus): QueryClient {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError(error) {
        if (error instanceof ApiError && error.status === 403) events.publish('toast:show', { kind: 'error', message: messageFor(error.problem) });
      },
    }),
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
}

/** The message for a failed request: the mapped `Problem.code`, never server text (MSG-3). */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? messageFor(error.problem) : t('errors.INTERNAL');
}
export const problemOf = (error: unknown): Problem | undefined => (error instanceof ApiError ? error.problem : undefined);

/** Tenant roles list their own tenant (no `tenantId`); admins pass the picked one (SPEC-STO-3). */
export const listParams = (tenantId: string | undefined): ListBucketsParams => ({ ...(tenantId ? { tenantId } : {}), limit: PAGE_SIZE });

// ── Queries ──

/** `params` undefined: an admin without a tenant (nothing to list yet). */
export function useBuckets(params: ListBucketsParams | undefined) {
  return useInfiniteQuery({
    queryKey: getListBucketsQueryKey(params ?? {}),
    queryFn: async ({ pageParam, signal }) => (await listBuckets({ ...params, ...(pageParam ? { cursor: pageParam } : {}) }, { signal })).data as BucketPage,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: params !== undefined,
  });
}

export function useQuotas(tenantId: string | undefined) {
  return useQuery({
    queryKey: getGetQuotasQueryKey(tenantId ?? ''),
    queryFn: async ({ signal }) => (await getQuotas(tenantId as string, { signal })).data as TenantQuotas,
    enabled: Boolean(tenantId),
  });
}

/** The picked tenant (admins): its name for the picker, its status for the banner (D8-09). */
export function useTenant(tenantId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: getGetTenantQueryKey(tenantId ?? ''),
    queryFn: async ({ signal }) => (await getTenant(tenantId as string, { signal })).data as Tenant,
    enabled: Boolean(tenantId) && enabled,
    staleTime: Infinity,
  });
}

/** Options for the admin tenant picker (D8-06): `query` undefined until the picker opens. */
export function useTenantSearch(query: string | undefined) {
  const params = { ...(query ? { q: query } : {}), sort: 'name' as const, limit: PICKER_LIMIT };
  return useQuery({
    queryKey: getListTenantsQueryKey(params),
    queryFn: async ({ signal }) => (await listTenants(params, { signal })).data as TenantPage,
    enabled: query !== undefined,
    staleTime: 30_000,
  });
}

// ── Cache helpers ──

const bucketsKey = getListBucketsQueryKey(); // ['/buckets']: the prefix of every list query

/** The tenant a cached list belongs to: its `tenantId` parameter, or the session's own tenant. */
const listTenant = (key: readonly unknown[], ownTenantId: string | undefined) => (key[1] as ListBucketsParams | undefined)?.tenantId ?? ownTenantId;

function patchLists(queryClient: QueryClient, tenantId: string, ownTenantId: string | undefined, patch: (items: Bucket[]) => Bucket[]): void {
  for (const [key, data] of queryClient.getQueriesData<BucketPages>({ queryKey: bucketsKey })) {
    if (!data || listTenant(key, ownTenantId) !== tenantId) continue;
    const before = data.pages.flatMap((page) => page.items);
    const items = patch(before);
    if (items === before) continue;
    const delta = items.length - before.length;
    // The loaded rows stay one sorted run on the first page; later pages keep only their cursors.
    const pages = data.pages.map((page, i) => ({ ...page, items: i === 0 ? items : [], total: page.total + delta }));
    queryClient.setQueryData<BucketPages>(key, { ...data, pages });
  }
}

/** Inserts or replaces a bucket by name in sorted position (server order is by name). */
export function upsertBucket(queryClient: QueryClient, bucket: Bucket, ownTenantId: string | undefined): void {
  patchLists(queryClient, bucket.tenantId, ownTenantId, (items) => {
    const rest = items.filter((b) => b.name !== bucket.name);
    const at = rest.findIndex((b) => b.name.localeCompare(bucket.name) > 0);
    return at === -1 ? [...rest, bucket] : [...rest.slice(0, at), bucket, ...rest.slice(at)];
  });
}

export function removeBucket(queryClient: QueryClient, tenantId: string, name: string, ownTenantId: string | undefined): void {
  patchLists(queryClient, tenantId, ownTenantId, (items) => items.filter((b) => b.name !== name));
}

export function patchTenantStatus(queryClient: QueryClient, id: string, status: TenantStatus): void {
  queryClient.setQueryData<Tenant>(getGetTenantQueryKey(id), (tenant) => (tenant && tenant.status !== status ? { ...tenant, status } : tenant));
}

// ── Server events (RT-3, RT-4, RT-6) ──

/** Applies server events to this area's cache. A reconnect invalidates this client's active queries. */
export function useServerEvents(events: ScopedBus, ownTenantId: string | undefined): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    const offs = [
      events.subscribe('server:bucket.updated', ({ tenantId, bucket, name }) =>
        bucket ? upsertBucket(queryClient, bucket, ownTenantId) : removeBucket(queryClient, tenantId, name, ownTenantId),
      ),
      events.subscribe('server:quota.updated', ({ tenantId, quotas }) => {
        if (queryClient.getQueryData(getGetQuotasQueryKey(tenantId))) queryClient.setQueryData(getGetQuotasQueryKey(tenantId), quotas);
      }),
      events.subscribe('server:tenant.updated', ({ tenant }) => patchTenantStatus(queryClient, tenant.id, tenant.status)),
      events.subscribe('realtime:reconnected', () => void queryClient.invalidateQueries()),
    ];
    return () => offs.forEach((off) => off());
  }, [events, queryClient, ownTenantId]);
}

// ── Mutations (SPEC-STO-2) ──

export function useCreateBucket(ownTenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: BucketCreate) => (await createBucket(body)).data as Bucket,
    onSuccess: (bucket) => upsertBucket(queryClient, bucket, ownTenantId),
  });
}

export function useDeleteBucket(ownTenantId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bucket: Bucket) => {
      await deleteBucket(bucket.name);
      return bucket;
    },
    onSuccess: (bucket) => removeBucket(queryClient, bucket.tenantId, bucket.name, ownTenantId),
    onError: (error, bucket) => {
      if (problemOf(error)?.code === 'TENANT_SUSPENDED') void queryClient.invalidateQueries({ queryKey: getGetTenantQueryKey(bucket.tenantId) });
    },
  });
}
