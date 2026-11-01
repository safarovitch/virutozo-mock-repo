// SPEC-TEN-3: the tenant drawer at /tenants/:tenantId?tab=…. Opening pushes, switching tabs replaces,
// closing pushes the list URL without `tab` (specs/shared/url-conventions.md).
import { useId, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { messageFor } from '@nimbus/api-client';
import { Permission, type Plan, type Task, type Tenant, type TenantQuotas } from '@nimbus/api-client/model';
import { bytesToGib, formatBytes, formatCount, formatDateTime, formatRelativeTime, gibToBytes } from '@nimbus/format';
import { isTerminal } from '@nimbus/realtime';
import { Button, Drawer, EmptyState, ErrorState, ProgressBar, Skeleton, StatusBadge, UsageBar, useCan } from '@nimbus/ui-kit';
import { useCtx, useGo } from './context';
import { errorMessage, problemOf, useActivity, useQuotas, useTenant, useUpdateQuotas } from './data';
import { t } from './messages/en';
import { TenantStatusBadge } from './TenantList';
import { TABS, type Tab, type TenantsUrl } from './url';

export function TenantDrawer({ url, plans }: { url: TenantsUrl; plans: ReadonlyMap<string, Plan> }) {
  const tenantId = url.tenantId;
  const go = useGo();
  const query = useTenant(tenantId);
  const close = () => go({ list: url.list, other: url.other }); // push the list URL without `tab`
  const tenant = query.data;
  const notFound = problemOf(query.error)?.code === 'NOT_FOUND';

  return (
    <Drawer open={Boolean(tenantId)} onClose={close} title={tenant?.displayName ?? tenantId ?? ''}>
      {tenantId &&
        (notFound ? (
          <EmptyState title={t('errors.NOT_FOUND')} />
        ) : query.error && !tenant ? (
          <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
        ) : !tenant ? (
          <Skeleton lines={6} />
        ) : (
          <DrawerTabs url={url} tenant={tenant} plan={plans.get(tenant.planId)} />
        ))}
    </Drawer>
  );
}

function DrawerTabs({ url, tenant, plan }: { url: TenantsUrl; tenant: Tenant; plan?: Plan }) {
  const go = useGo();
  const linkTo = useLinkTo();
  const baseId = useId();
  const vmsHref = `/compute?tenantId=${encodeURIComponent(tenant.id)}`;
  const bucketsHref = `/storage?tenantId=${encodeURIComponent(tenant.id)}`;
  const select = (tab: Tab) => go({ list: url.list, tenantId: tenant.id, tab, other: url.other }, { replace: true }); // AC-TEN-3.12
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = TABS.indexOf(url.tab);
    const next = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    const tab = TABS[(next + TABS.length) % TABS.length] as Tab;
    select(tab);
    document.getElementById(`${baseId}-${tab}`)?.focus();
  };

  return (
    <>
      <div role="tablist" className="tenants-tabs" aria-label={tenant.displayName}>
        {TABS.map((tab) => (
          <button
            key={tab}
            id={`${baseId}-${tab}`}
            type="button"
            role="tab"
            className="tenants-tabs__tab"
            aria-selected={url.tab === tab}
            aria-controls={`${baseId}-panel`}
            tabIndex={url.tab === tab ? 0 : -1}
            onClick={() => select(tab)}
            onKeyDown={onKeyDown}
          >
            {t(`tenants.drawer.tabs.${tab}`)}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-${url.tab}`} tabIndex={0}>
        {url.tab === 'overview' && <Overview tenant={tenant} plan={plan} />}
        {url.tab === 'quotas' && <Quotas tenant={tenant} plan={plan} />}
        {url.tab === 'activity' && <Activity tenantId={tenant.id} />}
      </div>
      <p className="tenants-drawer__links">
        <a href={vmsHref} onClick={linkTo(vmsHref)}>
          {t('tenants.menu.viewVms')}
        </a>
        <a href={bucketsHref} onClick={linkTo(bucketsHref)}>
          {t('tenants.menu.viewBuckets')}
        </a>
      </p>
    </>
  );
}

/** Real links (open in a new tab works) that navigate through the shell on a plain click. */
function useLinkTo() {
  const ctx = useCtx();
  return (to: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    ctx.navigate(to);
  };
}

function Overview({ tenant, plan }: { tenant: Tenant; plan?: Plan }) {
  return (
    <dl className="tenants-fields">
      <dt>{t('tenants.columns.displayName')}</dt>
      <dd>{tenant.displayName}</dd>
      <dt>{t('tenants.columns.name')}</dt>
      <dd>{tenant.name}</dd>
      <dt>{t('tenants.fields.id')}</dt>
      <dd>{tenant.id}</dd>
      <dt>{t('tenants.columns.status')}</dt>
      <dd>
        <TenantStatusBadge status={tenant.status} />
      </dd>
      <dt>{t('tenants.columns.plan')}</dt>
      <dd>{plan?.name ?? '—'}</dd>
      <dt>{t('tenants.fields.reseller')}</dt>
      <dd>{tenant.resellerId ?? '—'}</dd>
      <dt>{t('tenants.fields.adminEmail')}</dt>
      <dd>{tenant.adminEmail}</dd>
      <dt>{t('tenants.columns.created')}</dt>
      <dd>{formatDateTime(tenant.createdAt)}</dd>
    </dl>
  );
}

function Quotas({ tenant, plan }: { tenant: Tenant; plan?: Plan }) {
  const query = useQuotas(tenant.id);
  const canEdit = useCan(Permission['quota:update']);
  if (query.error && !query.data) return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  if (!query.data) return <Skeleton lines={4} />;
  const quotas = query.data;
  const suspended = tenant.status === 'suspended';
  return (
    <>
      <UsageBar
        label={t('tenants.columns.storage')}
        used={quotas.storageUsedBytes}
        total={quotas.storageQuotaBytes}
        valueText={t('tenants.storageUsage', { used: formatBytes(quotas.storageUsedBytes), quota: formatBytes(quotas.storageQuotaBytes) })}
      />
      {canEdit && !suspended ? (
        <QuotaForm tenantId={tenant.id} quotas={quotas} planName={plan?.name ?? ''} />
      ) : (
        <>
          {/* AC-TEN-3.4 / AC-TEN-3.11: read-only text, not disabled inputs */}
          <dl className="tenants-fields">
            <dt>{t('tenants.quotas.storage')}</dt>
            <dd>{formatBytes(quotas.storageQuotaBytes)}</dd>
            <dt>{t('tenants.quotas.vms')}</dt>
            <dd>{t('tenants.vmUsage', { count: formatCount(quotas.vmCount), quota: formatCount(quotas.vmQuota) })}</dd>
          </dl>
          {suspended && canEdit && <p className="tenants-note">{t('tenantStatus.suspendedTooltip')}</p>}
        </>
      )}
    </>
  );
}

type FieldErrors = { storage?: string; vms?: string; form?: string };

/** Client-side rules match the server's (D5-14): ≥ usage, ≤ plan max. Server 422s land on the same field. */
export function validateQuotas(quotas: TenantQuotas, planName: string, storageGib: number, vmQuota: number): FieldErrors {
  const errors: FieldErrors = {};
  const storageBytes = gibToBytes(storageGib);
  if (!Number.isInteger(storageGib) || storageGib < 1) errors.storage = t('errors.VALIDATION_FAILED');
  else if (storageBytes < quotas.storageUsedBytes) errors.storage = messageFor({ code: 'QUOTA_BELOW_USAGE', params: { resource: 'storage', used: quotas.storageUsedBytes } });
  else if (storageBytes > quotas.planMaxStorageQuotaBytes) errors.storage = messageFor({ code: 'QUOTA_EXCEEDS_PLAN', params: { resource: 'storage', plan: planName, max: quotas.planMaxStorageQuotaBytes } });
  if (!Number.isInteger(vmQuota) || vmQuota < 1) errors.vms = t('errors.VALIDATION_FAILED');
  else if (vmQuota < quotas.vmCount) errors.vms = messageFor({ code: 'QUOTA_BELOW_USAGE', params: { resource: 'vms', used: quotas.vmCount } });
  else if (vmQuota > quotas.planMaxVmQuota) errors.vms = messageFor({ code: 'QUOTA_EXCEEDS_PLAN', params: { resource: 'vms', plan: planName, max: quotas.planMaxVmQuota } });
  return errors;
}

function QuotaForm({ tenantId, quotas, planName }: { tenantId: string; quotas: TenantQuotas; planName: string }) {
  const ctx = useCtx();
  const storageId = useId();
  const vmsId = useId();
  const [storage, setStorage] = useState(String(bytesToGib(quotas.storageQuotaBytes)));
  const [vms, setVms] = useState(String(quotas.vmQuota));
  const [errors, setErrors] = useState<FieldErrors>({});
  const mutation = useUpdateQuotas(tenantId, ctx.events);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = validateQuotas(quotas, planName, Number(storage), Number(vms));
    setErrors(found);
    if (found.storage || found.vms) return;
    mutation.mutate(
      { storageQuotaBytes: gibToBytes(Number(storage)), vmQuota: Number(vms) },
      {
        onError: (error) => {
          const problem = problemOf(error);
          if (problem?.status === 403) return; // the shared toast handles it (AC-SHL-3.2)
          const message = errorMessage(error);
          const resource = problem?.params?.resource;
          setErrors(resource === 'storage' ? { storage: message } : resource === 'vms' ? { vms: message } : { form: message });
        },
      },
    );
  };

  return (
    <form className="tenants-quotas" onSubmit={submit} noValidate>
      <div className="nui-field">
        <label htmlFor={storageId}>{t('tenants.quotas.storage')}</label>
        <input id={storageId} className="nui-input" type="number" inputMode="numeric" min={1} step={1} value={storage} aria-invalid={Boolean(errors.storage)} aria-describedby={errors.storage ? `${storageId}-error` : undefined} onChange={(e) => setStorage(e.target.value)} />
        {errors.storage && <p id={`${storageId}-error`} className="tenants-error">{errors.storage}</p>}
      </div>
      <div className="nui-field">
        <label htmlFor={vmsId}>{t('tenants.quotas.vms')}</label>
        <input id={vmsId} className="nui-input" type="number" inputMode="numeric" min={1} step={1} value={vms} aria-invalid={Boolean(errors.vms)} aria-describedby={errors.vms ? `${vmsId}-error` : undefined} onChange={(e) => setVms(e.target.value)} />
        {errors.vms && <p id={`${vmsId}-error`} className="tenants-error">{errors.vms}</p>}
      </div>
      {errors.form && (
        <p role="alert" className="tenants-error">
          {errors.form}
        </p>
      )}
      <Button type="submit" variant="primary" loading={mutation.isPending}>
        {t('tenants.quotas.save')}
      </Button>
    </form>
  );
}

function Activity({ tenantId }: { tenantId: string }) {
  const query = useActivity(tenantId);
  if (query.error && !query.data) return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  if (!query.data) return <Skeleton lines={3} />;
  if (!query.data.items.length) return <EmptyState title={t('tenants.activity.empty')} />;
  return <ActivityList tasks={query.data.items} />;
}

export function ActivityList({ tasks, now = new Date() }: { tasks: readonly Task[]; now?: Date }) {
  return (
    <ul className="tenants-activity">
      {tasks.map((task) => {
        const kind = t(`taskKind.${task.kind}`);
        return (
          <li key={task.id}>
            <span>{kind}</span> <StatusBadge tone={task.status === 'failed' ? 'danger' : task.status === 'succeeded' ? 'success' : 'info'} label={t(`status.task.${task.status}`)} />{' '}
            <time dateTime={task.finishedAt ?? task.createdAt}>{formatRelativeTime(task.finishedAt ?? task.createdAt, now)}</time>
            {!isTerminal(task.status) && <ProgressBar label={t('tasks.progressLabel', { kind, name: task.resource.name })} value={task.progress / 100} />}
            {task.status === 'failed' && task.error && <p className="tenants-error">{messageFor(task.error)}</p>}
          </li>
        );
      })}
    </ul>
  );
}
