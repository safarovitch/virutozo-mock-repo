// SPEC-TEN-4 actions shared by the row menu and the drawer (D7-13 … D7-15), and the area's dialogs.
import { createContext, useContext } from 'react';
import { Permission, type Tenant } from '@nimbus/api-client/model';
import { ConfirmDialog, useCan } from '@nimbus/ui-kit';
import { t } from './messages/en';
import { useRunning } from './lifecycle';

export type LifecycleVerb = 'suspend' | 'resume';

export interface AreaActions {
  openCreate: () => void;
  openLifecycle: (tenant: Tenant, verb: LifecycleVerb) => void;
}

const NONE: AreaActions = { openCreate: () => undefined, openLifecycle: () => undefined };
export const AreaActionsContext = createContext<AreaActions>(NONE);
export const useAreaActions = () => useContext(AreaActionsContext);

export interface LifecycleAction {
  verb: LifecycleVerb;
  label: string;
  /** Set when the action is shown but can't be used (RBAC-4, D7-03). */
  disabledReason?: string;
}

/**
 * Which of Suspend / Resume a tenant offers, and why it's disabled: no permission (RBAC-4, AC-TEN-4.4),
 * a task already running (D7-01), or a status the server won't suspend (D7-03).
 */
export function useLifecycleAction(tenant: Tenant): LifecycleAction {
  const canSuspend = useCan(Permission['tenant:suspend']);
  const running = useRunning(tenant.id);
  const verb: LifecycleVerb = tenant.status === 'suspended' ? 'resume' : 'suspend';
  const label = t(verb === 'suspend' ? 'tenants.menu.suspend' : 'tenants.menu.resume');
  let disabledReason: string | undefined;
  if (!canSuspend) disabledReason = t('rbac.disabledTooltip', { action: t(verb === 'suspend' ? 'actions.suspendTenant' : 'actions.resumeTenant') });
  else if (running) disabledReason = t('tenants.lifecycleInProgress');
  else if (tenant.status === 'provisioning' || tenant.status === 'error') disabledReason = t('tenants.suspendUnavailable');
  return { verb, label, ...(disabledReason ? { disabledReason } : {}) };
}

export interface LifecycleDialogProps {
  target: { tenant: Tenant; verb: LifecycleVerb } | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Suspend: a danger dialog with type-the-name (AC-TEN-4.1, D7-13). Resume: a plain confirm (D7-02). */
export function LifecycleDialog({ target, busy, onConfirm, onCancel }: LifecycleDialogProps) {
  const tenant = target?.tenant;
  const suspend = target?.verb === 'suspend';
  const params = { name: tenant?.name ?? '', displayName: tenant?.displayName ?? '' };
  return (
    <ConfirmDialog
      open={Boolean(target)}
      title={t(suspend ? 'tenants.suspend.title' : 'tenants.resume.title', params)}
      confirmLabel={t(suspend ? 'tenants.suspend.confirm' : 'tenants.resume.confirm')}
      danger={suspend}
      {...(suspend && tenant ? { confirmText: tenant.name } : {})}
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <p>{t(suspend ? 'tenants.suspend.body' : 'tenants.resume.body', params)}</p>
    </ConfirmDialog>
  );
}
