// SPEC-TEN-1: server-side search, filters and sort from the URL; infinite scroll over cursor pages;
// virtualised rows; live status through the area's cache (AC-TEN-1.6).
import { useEffect, useId, useMemo, useRef, useState, type Ref } from 'react';
import { Permission, type Plan, type Tenant, type TenantStatus } from '@nimbus/api-client/model';
import { TenantStatus as Statuses } from '@nimbus/api-client/model';
import { formatBytes, formatCount, formatDateTime } from '@nimbus/format';
import { Button, DataTable, EmptyState, ErrorState, StatusBadge, UsageBar, dataTableColumns, useCan, type SortingState, type StatusTone } from '@nimbus/ui-kit';
import { useAreaActions, useLifecycleAction } from './actions';
import { useCtx, useGo } from './context';
import { errorMessage } from './data';
import { useRunning } from './lifecycle';
import { t } from './messages/en';
import { RowMenu } from './RowMenu';
import { columnToSort, hasFilters, sortToColumn, type ListState, type SortColumn, type TenantsUrl } from './url';

export const SEARCH_DEBOUNCE_MS = 300; // AC-TEN-1.2
export const ROW_HEIGHT = 44;

const TONES: Record<TenantStatus, StatusTone> = { active: 'success', suspended: 'warning', provisioning: 'info', error: 'danger' };

export function TenantStatusBadge({ status }: { status: TenantStatus }) {
  return <StatusBadge tone={TONES[status]} label={t(`status.tenant.${status}`)} />;
}

/** The status, or "Suspending…" / "Resuming…" with a spinner while such a task runs (D7-01). */
export function TenantStatusCell({ tenant }: { tenant: Pick<Tenant, 'id' | 'status'> }) {
  const running = useRunning(tenant.id);
  if (!running) return <TenantStatusBadge status={tenant.status} />;
  return (
    <span className="tenants-status--busy">
      <span className="nui-spinner" aria-hidden="true" />
      <StatusBadge tone="info" label={t(running.kind === 'tenant.suspend' ? 'status.tenant.suspending' : 'status.tenant.resuming')} />
    </span>
  );
}

export interface TenantListViewProps {
  url: TenantsUrl;
  rows: readonly Tenant[];
  total?: number;
  plans: ReadonlyMap<string, Plan>;
  plansReady: boolean;
  loading: boolean;
  error?: unknown;
  fetchingMore: boolean;
  refreshing: boolean;
  onRetry: () => void;
  onEndReached?: () => void;
  /** Height of the scrolling table; the page fills the viewport in the app. */
  height?: number;
  /** The toolbar's *Create tenant*: focus returns here when the wizard closes (AC-TEN-2.6, D7-10). */
  createRef?: Ref<HTMLButtonElement>;
}

/** The list without data fetching, so every state has a story (H6). */
export function TenantListView({ url, rows, total, plans, plansReady, loading, error, fetchingMore, refreshing, onRetry, onEndReached, height = 600, createRef }: TenantListViewProps) {
  const ctx = useCtx();
  const actions = useAreaActions();
  const canCreate = useCan(Permission['tenant:create']); // hidden without it (RBAC-4 toolbar rule, D5-16)
  const go = useGo();
  const { list } = url;
  const setList = (next: ListState, options?: { replace?: boolean }) => go({ list: next, other: url.other }, options);

  const col = dataTableColumns<Tenant>();
  const columns = useMemo(
    () =>
      col.columns([
        col.accessor('name', { header: t('tenants.columns.name') }),
        col.accessor('displayName', { header: t('tenants.columns.displayName'), enableSorting: false }),
        col.accessor('status', { header: t('tenants.columns.status'), enableSorting: false, cell: (c) => <TenantStatusCell tenant={c.row.original} /> }),
        col.accessor('planId', { header: t('tenants.columns.plan'), enableSorting: false, cell: (c) => plans.get(c.getValue())?.name ?? '—' }),
        col.accessor('storageUsedBytes', {
          id: 'storageUsedBytes',
          header: t('tenants.columns.storage'),
          sortDescFirst: true, // D5-01: largest first
          cell: (c) => {
            const row = c.row.original;
            return <UsageBar label={t('tenants.columns.storage')} used={row.storageUsedBytes} total={row.storageQuotaBytes} valueText={t('tenants.storageUsage', { used: formatBytes(row.storageUsedBytes), quota: formatBytes(row.storageQuotaBytes) })} />;
          },
        }),
        col.accessor('vmQuota', { header: t('tenants.columns.vmQuota'), enableSorting: false, cell: (c) => t('tenants.vmUsage', { count: formatCount(c.row.original.vmCount), quota: formatCount(c.getValue()) }) }),
        col.accessor('createdAt', { header: t('tenants.columns.created'), sortDescFirst: true, cell: (c) => formatDateTime(c.getValue()) }), // D5-01: newest first
      ]),
    [plans],
  );

  const sorting: SortingState = [sortToColumn(list.sort)];
  const onSortingChange = (updater: SortingState | ((old: SortingState) => SortingState)) => {
    const next = (typeof updater === 'function' ? updater(sorting) : updater)[0];
    if (next) setList({ ...list, sort: columnToSort(next.id as SortColumn, next.desc) }); // push (D5-04)
  };

  const open = (row: Tenant) => go({ list, tenantId: row.id, other: url.other }); // push: Back closes it

  const filtered = hasFilters(list);
  let empty;
  if (filtered) {
    empty = (
      <EmptyState
        title={t('tenants.noMatches')}
        action={
          <button type="button" className="nui-button nui-button--secondary" onClick={() => setList({ sort: list.sort })}>
            {t('tenants.clearFilters')}
          </button>
        }
      />
    );
  } else {
    empty = (
      <EmptyState
        title={t('tenants.empty')}
        action={
          canCreate ? (
            <Button variant="primary" onClick={actions.openCreate}>
              {t('tenants.create')}
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <section className="tenants-list" aria-labelledby="tenants-title">
      <header className="tenants-list__header">
        <h1 id="tenants-title">{t('tenants.title')}</h1>
        {canCreate && (
          <Button ref={createRef} variant="primary" onClick={actions.openCreate}>
            {t('tenants.create')}
          </Button>
        )}
        {total !== undefined && !error && (
          <p className="tenants-list__count" aria-live="polite">
            {t('tenants.list.count', { shown: formatCount(rows.length), total: formatCount(total) })}
          </p>
        )}
      </header>
      <Toolbar list={list} plans={plans} plansReady={plansReady} onChange={setList} />
      {error && !rows.length ? (
        <ErrorState message={errorMessage(error)} onRetry={onRetry} />
      ) : (
        <DataTable
          label={t('tenants.title')}
          columns={columns}
          data={rows}
          getRowId={(r) => r.id}
          rowCount={total}
          sorting={sorting}
          onSortingChange={onSortingChange}
          onRowActivate={open}
          loading={loading}
          skeletonRows={10}
          fetchingMore={fetchingMore}
          refreshing={refreshing}
          onEndReached={onEndReached}
          empty={empty}
          height={height}
          rowHeight={ROW_HEIGHT}
          rowActions={(row) => <TenantRowMenu tenant={row} onOpen={() => open(row)} navigate={ctx.navigate} />}
        />
      )}
    </section>
  );
}

function TenantRowMenu({ tenant, onOpen, navigate }: { tenant: Tenant; onOpen: () => void; navigate: (to: string) => void }) {
  const actions = useAreaActions();
  const lifecycle = useLifecycleAction(tenant);
  return (
    <RowMenu
      name={tenant.name}
      items={[
        { label: t('tenants.menu.open'), onSelect: onOpen },
        { label: t('tenants.menu.viewVms'), onSelect: () => navigate(`/compute?tenantId=${encodeURIComponent(tenant.id)}`) },
        { label: t('tenants.menu.viewBuckets'), onSelect: () => navigate(`/storage?tenantId=${encodeURIComponent(tenant.id)}`) },
        { label: lifecycle.label, onSelect: () => actions.openLifecycle(tenant, lifecycle.verb), ...(lifecycle.disabledReason ? { disabledReason: lifecycle.disabledReason } : {}) },
      ]}
    />
  );
}

function Toolbar({ list, plans, plansReady, onChange }: { list: ListState; plans: ReadonlyMap<string, Plan>; plansReady: boolean; onChange: (next: ListState, options?: { replace?: boolean }) => void }) {
  const searchId = useId();
  const statusId = useId();
  const planId = useId();
  const [text, setText] = useState(list.q ?? '');
  const searching = useRef(false); // D5-04: the first commit of a search pushes, later ones replace
  const latest = useRef(list);
  latest.current = list;

  // The URL changed from outside (Back, Clear filters): show it.
  useEffect(() => {
    if (!searching.current) setText(list.q ?? '');
  }, [list.q]);

  useEffect(() => {
    const q = text.trim();
    if (q === (latest.current.q ?? '')) return;
    const timer = setTimeout(() => {
      onChange({ ...latest.current, q: q || undefined }, { replace: searching.current });
      searching.current = true;
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  return (
    <div className="tenants-toolbar" role="search">
      <div className="nui-field">
        <label htmlFor={searchId}>{t('tenants.search')}</label>
        <input
          id={searchId}
          className="nui-input"
          type="search"
          maxLength={100}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            searching.current = false;
          }}
        />
      </div>
      <div className="nui-field">
        <label htmlFor={statusId}>{t('tenants.filter.status')}</label>
        <select
          id={statusId}
          className="nui-input"
          value={list.status ?? ''}
          onChange={(e) => {
            onChange({ ...list, status: (e.target.value || undefined) as TenantStatus | undefined });
          }}
        >
          <option value="">{t('tenants.filter.all')}</option>
          {Object.values(Statuses).map((s) => (
            <option key={s} value={s}>
              {t(`status.tenant.${s}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="nui-field">
        <label htmlFor={planId}>{t('tenants.filter.plan')}</label>
        <select
          id={planId}
          className="nui-input"
          value={plansReady ? (list.planId ?? '') : ''}
          disabled={!plansReady}
          onChange={(e) => {
            onChange({ ...list, planId: e.target.value || undefined });
          }}
        >
          <option value="">{t('tenants.filter.all')}</option>
          {[...plans.values()].map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

