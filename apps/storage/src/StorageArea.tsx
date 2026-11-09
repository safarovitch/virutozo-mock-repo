// The Storage area: usage card and bucket list (SPEC-STO-1), create/delete (SPEC-STO-2), and the admin
// view (SPEC-STO-3): the tenant picker with `?tenantId`, the choose-a-tenant state and the suspended
// banner. Admins never get write actions (no bucket permissions, D8-12).
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Permission, type Bucket } from '@nimbus/api-client/model';
import { formatBytes, formatCount, formatDateTime } from '@nimbus/format';
import { Button, ConfirmDialog, DataTable, EmptyState, ErrorState, dataTableColumns, useCan } from '@nimbus/ui-kit';
import { useCtx, useGo } from './context';
import { CreateBucketDialog } from './CreateBucketDialog';
import { errorMessage, listParams, problemOf, useBuckets, useDeleteBucket, useQuotas, useServerEvents, useTenant } from './data';
import { t } from './messages/en';
import { TenantPicker } from './TenantPicker';
import { UsageCard } from './UsageCard';
import { parsePath } from './url';

const col = dataTableColumns<Bucket>();
const COLUMNS = col.columns([
  col.accessor('name', { header: t('storage.columns.name') }),
  col.accessor('sizeBytes', { header: t('storage.columns.size'), cell: (c) => formatBytes(c.getValue()) }),
  col.accessor('objectCount', { header: t('storage.columns.objects'), cell: (c) => formatCount(c.getValue()) }),
  col.accessor('versioning', { header: t('storage.columns.versioning'), cell: (c) => t(c.getValue() ? 'storage.versioning.on' : 'storage.versioning.off') }),
  col.accessor('createdAt', { header: t('storage.columns.created'), cell: (c) => formatDateTime(c.getValue()) }),
]);
const ROW_HEIGHT = 40;

export function StorageArea() {
  const ctx = useCtx();
  const go = useGo();
  const own = ctx.session.tenant;
  const admin = own === null;
  const url = parsePath(ctx.path, admin);
  useServerEvents(ctx.events, own?.id);

  // url-conventions: tenant roles lose `tenantId`; an invalid one is dropped without a history entry.
  useEffect(() => {
    if (url.needsCorrection) go(url, { replace: true });
  }, [ctx.path, url.needsCorrection]);

  const tenantId = own ? own.id : url.tenantId;
  const canReadTenants = useCan(Permission['tenant:read']);
  const canCreate = useCan(Permission['bucket:create']);
  const canDelete = useCan(Permission['bucket:delete']);

  const list = useBuckets(admin && !tenantId ? undefined : listParams(admin ? tenantId : undefined));
  const quotas = useQuotas(tenantId);
  const tenant = useTenant(url.tenantId, admin && canReadTenants);
  const picked = tenant.data?.id === url.tenantId ? tenant.data : undefined;
  const rows = useMemo(() => list.data?.pages.flatMap((page) => page.items) ?? [], [list.data]);

  // D8-09 / D8-12: a suspended tenant blocks every change; admins see the in-area banner.
  const suspended = own ? own.status === 'suspended' : picked?.status === 'suspended';
  const blocked = suspended ? t('tenantStatus.suspendedTooltip') : undefined;

  // ── Dialogs (modal state, not URL state) ──
  const [creating, setCreating] = useState(false);
  const createRef = useRef<HTMLButtonElement>(null);
  const [deleting, setDeleting] = useState<Bucket | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const remove = useDeleteBucket(own?.id);
  const areaRef = useRef<HTMLElement>(null);

  const closeDelete = () => {
    setDeleting(null);
    setDeleteError(null);
  };
  const confirmDelete = () => {
    if (!deleting || remove.isPending) return;
    const index = rows.findIndex((b) => b.name === deleting.name);
    const next = rows[index + 1]?.name ?? rows[index - 1]?.name;
    setDeleteError(null);
    remove.mutate(deleting, {
      onSuccess: (bucket) => {
        closeDelete();
        ctx.events.publish('toast:show', { kind: 'success', message: t('storage.toast.deleted', { name: bucket.name }) });
        // D8-14: focus moves to the next row's Delete, or to Create bucket when no row is left.
        requestAnimationFrame(() => {
          const target = next ? areaRef.current?.querySelector<HTMLElement>(`[data-delete-bucket="${CSS.escape(next)}"]`) : null;
          (target ?? createRef.current)?.focus();
        });
      },
      // D8-01: BUCKET_NOT_EMPTY (and anything else) shows inline; the dialog stays open. 403: the shell's toast.
      onError: (error) => {
        if (problemOf(error)?.status !== 403) setDeleteError(errorMessage(error));
      },
    });
  };

  const onCreated = (bucket: Bucket) => {
    setCreating(false);
    ctx.events.publish('toast:show', { kind: 'success', message: t('storage.toast.created', { name: bucket.name }) });
  };

  const openTenant = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    ctx.navigate(`/tenants/${encodeURIComponent(url.tenantId ?? '')}`);
  };

  const createButton = (ref?: typeof createRef) =>
    canCreate && (
      <Button ref={ref} variant="primary" {...(blocked ? { disabledReason: blocked } : {})} onClick={() => setCreating(true)}>
        {t('storage.create.title')}
      </Button>
    );

  // D8-08: a tenant outside the caller's scope is a 404 for the list and the quotas; Retry can't help.
  const notFound = problemOf(list.error)?.status === 404 || problemOf(quotas.error)?.status === 404;

  let content;
  if (admin && !tenantId) content = <EmptyState title={t('storage.chooseTenant')} />;
  else if (notFound) content = <ErrorState message={t('errors.NOT_FOUND')} />;
  else
    content = (
      <>
        {admin && suspended && picked && (
          <div className="nui-banner" role="status">
            <span>{t('tenantStatus.suspendedAdminBanner', { tenant: picked.displayName })}</span>
            {canReadTenants && (
              <a href={`/tenants/${picked.id}`} onClick={openTenant}>
                {t('tenantStatus.openTenant')}
              </a>
            )}
          </div>
        )}
        <UsageCard quotas={quotas.data} loading={quotas.isPending} {...(quotas.error ? { error: errorMessage(quotas.error) } : {})} onRetry={() => void quotas.refetch()} />
        {canCreate && <div className="storage-toolbar">{createButton(createRef)}</div>}
        {list.error ? (
          <ErrorState message={errorMessage(list.error)} onRetry={() => void list.refetch()} />
        ) : (
          <DataTable
            label={t('storage.title')}
            columns={COLUMNS}
            data={rows}
            getRowId={(b) => b.name}
            loading={list.isPending}
            skeletonRows={5}
            empty={<EmptyState title={t('storage.empty')} action={createButton()} />}
            height={Math.min(Math.max(rows.length, 3), 15) * ROW_HEIGHT + ROW_HEIGHT + 8}
            rowHeight={ROW_HEIGHT}
            {...(canDelete
              ? {
                  rowActions: (bucket: Bucket) => (
                    <Button
                      variant="ghost"
                      aria-label={t('storage.deleteFor', { name: bucket.name })}
                      data-delete-bucket={bucket.name}
                      {...(blocked ? { disabledReason: blocked } : {})}
                      onClick={() => setDeleting(bucket)}
                    >
                      {t('menu.deleteBucket')}
                    </Button>
                  ),
                }
              : {})}
          />
        )}
        {list.hasNextPage && (
          <Button loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
            {t('storage.loadMore')}
          </Button>
        )}
      </>
    );

  return (
    <section className="storage" ref={areaRef}>
      <h1>{t('areas.storage')}</h1>
      {admin && (
        <div className="storage-context">
          <TenantPicker value={picked?.displayName} onSelect={(id) => go({ tenantId: id, other: url.other })} />
        </div>
      )}
      {content}
      <CreateBucketDialog open={creating} ownTenantId={own?.id} onClose={() => setCreating(false)} onCreated={onCreated} />
      <ConfirmDialog
        open={deleting !== null}
        title={t('storage.delete.title', { name: deleting?.name ?? '' })}
        confirmLabel={t('storage.delete.confirm')}
        danger
        {...(deleting ? { confirmText: deleting.name } : {})}
        busy={remove.isPending}
        onConfirm={confirmDelete}
        onCancel={closeDelete}
      >
        <p>{t('storage.delete.body')}</p>
        {deleteError && <p role="alert">{deleteError}</p>}
      </ConfirmDialog>
    </section>
  );
}
