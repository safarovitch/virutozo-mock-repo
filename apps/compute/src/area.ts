// What components share inside the compute area: the context, URL navigation and the action rules.
import { computed, inject, type ComputedRef, type InjectionKey } from 'vue';
import { Permission, type Vm, type VmAction } from '@nimbus/api-client/model';
import { can } from '@nimbus/auth';
import type { RemoteContext } from '@nimbus/mf-contract';
import { CTX_KEY } from './context';
import { isTransitional } from './data';
import { t } from './messages/en';
import { toPath } from './url';

export function useCtx(): ComputedRef<RemoteContext> {
  const ctx = inject(CTX_KEY);
  if (!ctx) throw new Error('compute: RemoteContext missing (CTX_KEY)');
  return computed(() => ctx.value);
}

/** Navigates within the area (MF-1). Push for opening and closing, `replace` for corrections (url-conventions). */
export function useGo() {
  const ctx = useCtx();
  return (state: Parameters<typeof toPath>[0], options?: { replace?: boolean }) => {
    const path = toPath(state); // "/", "/?tenantId=t_acme", "/vm_01?tenantId=t_acme"
    ctx.value.navigate(`${ctx.value.basePath}${path === '/' || path.startsWith('/?') ? path.slice(1) : path}`, options);
  };
}

export const ACTIONS: readonly VmAction[] = ['start', 'stop', 'reboot'];
const VALID_FROM: Record<VmAction, Vm['status']> = { start: 'stopped', stop: 'running', reboot: 'running' };

export interface ActionState {
  /** Not valid for this status (e.g. *Stop* on a stopped VM): a plain disabled button. */
  disabled: boolean;
  /** Why every action is blocked: shown as the button's tooltip and keeps it focusable (RBAC-4, D3-10). */
  reason?: string;
}

/**
 * The action rules (SPEC-CMP-2, SPEC-SHL-8, SPEC-CMP-4, D6-03): a suspended tenant blocks everything
 * (`blockedReason`), then a running operation (AC-CMP-2.4), then the `error` status; otherwise each
 * action is valid from one status.
 */
export function actionState(vm: Vm, action: VmAction, blockedReason: string | undefined): ActionState {
  if (blockedReason) return { disabled: false, reason: blockedReason };
  if (vm.activeTaskId || isTransitional(vm.status)) return { disabled: false, reason: t('compute.operationInProgress') };
  if (vm.status === 'error') return { disabled: false, reason: t('compute.vmInError') };
  return { disabled: vm.status !== VALID_FROM[action] };
}

/** Whether the tenant an admin picked is suspended (SPEC-CMP-4); provided by ComputeArea. */
export const PICKED_SUSPENDED_KEY: InjectionKey<ComputedRef<boolean>> = Symbol('compute-picked-suspended');

/** Who may act, and on what (RBAC-4: without `vm:operate` the buttons aren't rendered). */
export function useActionRules() {
  const ctx = useCtx();
  const pickedSuspended = inject(PICKED_SUSPENDED_KEY, null);
  return {
    canOperate: computed(() => can(ctx.value.session, Permission['vm:operate'])),
    /** Why every action is blocked: the own tenant (SPEC-SHL-8) or the picked tenant (AC-CMP-4.4) is suspended. */
    blockedReason: computed(() => {
      const own = ctx.value.session.tenant;
      if (own) return own.status === 'suspended' ? t('tenantStatus.suspendedBanner') : undefined;
      return pickedSuspended?.value ? t('tenantStatus.suspendedTooltip') : undefined;
    }),
  };
}

export interface ActionsApi {
  request(vm: Vm, action: VmAction): void;
}
export const ACTIONS_KEY: InjectionKey<ActionsApi> = Symbol('compute-actions');

export function useActions(): ActionsApi {
  const api = inject(ACTIONS_KEY);
  if (!api) throw new Error('compute: ACTIONS_KEY missing');
  return api;
}

export const statusLabel = (status: Vm['status']) => t(`status.vm.${status}`);
