// The Tenants area: list (SPEC-TEN-1) with the drawer (SPEC-TEN-3) over it.
import { useEffect, useMemo } from 'react';
import { Permission } from '@nimbus/api-client/model';
import type { RemoteContext } from '@nimbus/mf-contract';
import { EmptyState, SessionProvider, useCan } from '@nimbus/ui-kit';
import { CtxContext, useCtx, useGo } from './context';
import { usePlans, useServerEvents, useTenantList } from './data';
import { t } from './messages/en';
import { TenantDrawer } from './TenantDrawer';
import { TenantListView } from './TenantList';
import { listParams, parsePath } from './url';

export function App({ ctx }: { ctx: RemoteContext }) {
  return (
    <CtxContext.Provider value={ctx}>
      <SessionProvider session={ctx.session}>
        <TenantsArea />
      </SessionProvider>
    </CtxContext.Provider>
  );
}

function TenantsArea() {
  const canRead = useCan(Permission['tenant:read']);
  // The shell's 403 page normally catches this (AC-SHL-3.1); the area still never renders data without it (D5-09).
  if (!canRead) return <NoAccess />;
  return <TenantsPage />;
}

export function NoAccess() {
  return <EmptyState title={t('shell.noAccess.title')} description={t('shell.noAccess.body')} />;
}

function TenantsPage() {
  const ctx = useCtx();
  const go = useGo();
  useServerEvents(ctx.events);
  const plans = usePlans();
  const planIds = useMemo(() => (plans.data ? new Set(plans.byId.keys()) : undefined), [plans.data, plans.byId]);
  const url = parsePath(ctx.path, planIds);

  // D5-06, AC-TEN-3.13: invalid values are dropped from the URL without a history entry.
  useEffect(() => {
    if (url.needsCorrection) go(url, { replace: true });
  }, [ctx.path, url.needsCorrection]);

  const params = listParams(url.list);
  const list = useTenantList(params);
  const rows = useMemo(() => list.data?.pages.flatMap((page) => page.items) ?? [], [list.data]);
  const total = list.data?.pages[0]?.total;

  return (
    <>
      <TenantListView
        url={url}
        rows={rows}
        total={total}
        plans={plans.byId}
        plansReady={Boolean(plans.data)}
        loading={list.isPending}
        error={list.error}
        fetchingMore={list.isFetchingNextPage}
        refreshing={list.isFetching && !list.isPending && !list.isFetchingNextPage}
        onRetry={() => void list.refetch()}
        onEndReached={list.hasNextPage ? () => void list.fetchNextPage() : undefined}
        height={Math.max(window.innerHeight - 260, 320)}
      />
      <TenantDrawer url={url} plans={plans.byId} />
    </>
  );
}
