// The Tenants area: list (SPEC-TEN-1) with the drawer (SPEC-TEN-3) over it.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Tenant } from '@nimbus/api-client/model';
import { Permission } from '@nimbus/api-client/model';
import type { RemoteContext } from '@nimbus/mf-contract';
import { EmptyState, SessionProvider, useCan } from '@nimbus/ui-kit';
import { CtxContext, useCtx, useGo } from './context';
import { AreaActionsContext, LifecycleDialog, type AreaActions, type LifecycleVerb } from './actions';
import { CreateTenantWizard } from './CreateTenantWizard';
import { usePlans, useServerEvents, useTenantLifecycle, useTenantList } from './data';
import { LifecycleContext, createLifecycleStore, useLifecycleEvents } from './lifecycle';
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
  const ctx = useCtx();
  const canRead = useCan(Permission['tenant:read']);
  // SPEC-SHL-4: a render-time crash for tests, removed from production builds (ci/no-test-hooks).
  if (import.meta.env.MODE !== 'production' && ctx.path.split(/[?#]/)[0] === '/__crash') return <Crash />;
  // The shell's 403 page normally catches this (AC-SHL-3.1); the area still never renders data without it (D5-09).
  if (!canRead) return <NoAccess />;
  return <TenantsPage />;
}

function Crash(): never {
  throw new Error('tenants: render crash for tests');
}

export function NoAccess() {
  return <EmptyState title={t('shell.noAccess.title')} description={t('shell.noAccess.body')} />;
}

function TenantsPage() {
  const ctx = useCtx();
  const go = useGo();
  useServerEvents(ctx.events);
  const [store] = useState(createLifecycleStore);
  useLifecycleEvents(ctx.events, store);

  // SPEC-TEN-2 wizard and SPEC-TEN-4 dialogs: modal state, not in the URL (D7-05).
  const [creating, setCreating] = useState(false);
  const createRef = useRef<HTMLButtonElement>(null);
  const [target, setTarget] = useState<{ tenant: Tenant; verb: LifecycleVerb } | null>(null);
  const lifecycle = useTenantLifecycle(ctx.events, (task) => store.started(task));
  const actions = useMemo<AreaActions>(
    () => ({ openCreate: () => setCreating(true), openLifecycle: (tenant, verb) => setTarget({ tenant, verb }) }),
    [],
  );
  const closeWizard = () => {
    setCreating(false);
    // D7-10: back to the toolbar button, also when the wizard was opened from the empty state.
    requestAnimationFrame(() => {
      if (!document.activeElement || document.activeElement === document.body) createRef.current?.focus();
    });
  };
  const confirmLifecycle = () => {
    if (!target || lifecycle.isPending) return;
    lifecycle.mutate({ tenantId: target.tenant.id, kind: target.verb }, { onSettled: () => setTarget(null) });
  };

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
    <AreaActionsContext.Provider value={actions}>
      <LifecycleContext.Provider value={store}>
        <TenantListView
          createRef={createRef}
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
        <CreateTenantWizard open={creating} onClose={closeWizard} />
        <LifecycleDialog
          target={target}
          busy={lifecycle.isPending}
          onConfirm={confirmLifecycle}
          onCancel={() => setTarget(null)}
        />
      </LifecycleContext.Provider>
    </AreaActionsContext.Provider>
  );
}
