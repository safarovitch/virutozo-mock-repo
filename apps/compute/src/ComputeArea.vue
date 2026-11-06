<script setup lang="ts">
// The Compute area: VM list (SPEC-CMP-1) with the drawer over it (SPEC-CMP-5), actions (SPEC-CMP-2) and
// the admin view of SPEC-CMP-4: the tenant picker with `?tenantId`, the choose-a-tenant state, "Acting on
// tenant", a confirmation naming the tenant for every admin action, and the suspended-tenant banner.
import { computed, inject, onUnmounted, provide, watch } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { Permission, type Vm, type VmAction } from '@nimbus/api-client/model';
import { can } from '@nimbus/auth';
import { ConfirmDialog, EmptyState } from '@nimbus/ui-kit-vue';
import { ACTIONS_KEY, PICKED_SUSPENDED_KEY, statusLabel, useActionRules, useCtx, useGo } from './area';
import { errorMessage, listParams, problemOf, subscribeComputeEvents, taskOutcomeMessage, useTenant, useVm, useVmAction, useVmList } from './data';
import { t } from './messages/en';
import { BUS_KEY } from './realtime/bus';
import { useComputeUi } from './ui-store';
import { parsePath } from './url';
import TenantPicker from './TenantPicker.vue';
import VmDrawer from './VmDrawer.vue';
import VmList from './VmList.vue';

const ctx = useCtx();
const bus = inject(BUS_KEY);
if (!bus) throw new Error('compute: BUS_KEY missing');
const go = useGo();
const ui = useComputeUi();
const queryClient = useQueryClient();
const { canOperate } = useActionRules();

// ── URL (url-conventions) ──
const admin = computed(() => ctx.value.session.tenant === null);
const url = computed(() => parsePath(ctx.value.path, admin.value));

// Tenant roles: `tenantId` is removed. Admins: an invalid one is dropped (no history entry).
watch(
  () => url.value.needsCorrection,
  (needs) => {
    if (needs) go(url.value, { replace: true });
  },
  { immediate: true },
);

// An admin opening /compute/:vmId without tenantId: load the VM, then add its tenant (AC-CMP-5.4).
const drawerVm = useVm(() => url.value.vmId);
watch(
  () => [admin.value, url.value.tenantId, drawerVm.data.value?.tenantId, drawerVm.isPlaceholderData.value] as const,
  ([isAdmin, tenantId, vmTenant, placeholder]) => {
    if (isAdmin && !tenantId && vmTenant && !placeholder && !url.value.needsCorrection) go({ ...url.value, tenantId: vmTenant }, { replace: true });
  },
  { immediate: true },
);

// ── Data ──
const params = computed(() => (admin.value ? (url.value.tenantId ? listParams(url.value.tenantId) : undefined) : listParams(undefined)));
const list = useVmList(params);
const rows = computed<Vm[]>(() => list.data.value?.pages.flatMap((page) => page.items) ?? []);
const canReadTenants = computed(() => can(ctx.value.session, Permission['tenant:read']));
const tenant = useTenant(() => url.value.tenantId, () => admin.value && canReadTenants.value);
const tenantName = computed(() => (tenant.data.value?.id === url.value.tenantId ? tenant.data.value?.displayName : undefined));
// AC-CMP-4.4: a suspended picked tenant blocks every action, in the list and the drawer.
const pickedSuspended = computed(() => admin.value && tenant.data.value?.id === url.value.tenantId && tenant.data.value?.status === 'suspended');
provide(PICKED_SUSPENDED_KEY, pickedSuspended);
// D8-08: retrying a 404 (a tenant outside the caller's scope) can't help.
const listError = computed(() => (list.error.value ? errorMessage(list.error.value) : undefined));
const listRetryable = computed(() => problemOf(list.error.value)?.status !== 404);

// ── Server events (RT-4…RT-7) ──
const unsubscribe = subscribeComputeEvents(bus, queryClient, {
  onStatusChange: ({ name, status }) => ui.announce(t('compute.vmNowStatus', { name, status: statusLabel(status).toLowerCase() })),
  onTaskFinished: (task) => {
    if (!ui.takeFinished(task.id)) return; // only tasks started here; the task center shows the rest (D6-10)
    bus.publish('toast:show', { kind: task.status === 'failed' ? 'error' : 'success', message: taskOutcomeMessage(task), resource: { type: 'vm', id: task.resource.id } });
  },
});
onUnmounted(() => {
  unsubscribe();
  ui.stop();
});

// ── Actions (SPEC-CMP-2, D6-09, AC-CMP-4.3) ──
const mutation = useVmAction(bus, (task) => ui.trackStarted(task.id));
const run = (vm: Vm, action: VmAction) => mutation.mutate({ vm, action });
provide(ACTIONS_KEY, {
  request(vm, action) {
    if (action === 'stop' || admin.value) ui.askConfirm(vm, action);
    else run(vm, action);
  },
});

const confirmText = computed(() => {
  const pending = ui.confirming;
  if (!pending) return { title: '', label: '', body: '' };
  const name = pending.vm.name;
  const label = t(`compute.actions.${pending.action}`);
  const title = admin.value
    ? t('compute.confirmOnTenant', { action: label, name, tenant: tenant.data.value?.displayName ?? pending.vm.tenantId })
    : t('compute.confirmStop.title', { name });
  return { title, label, body: pending.action === 'stop' ? t('compute.confirmStop.body', { name }) : '' };
});
function confirm() {
  const pending = ui.confirming;
  ui.clearConfirm();
  if (pending) run(pending.vm, pending.action);
}

// ── Navigation ──
// D8-06: picking is a filter change (push); it keeps other parameters and closes an open drawer.
const pick = (tenantId: string) => go({ tenantId, other: url.value.other });
function openTenant(event: MouseEvent) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  ctx.value.navigate(`/tenants/${encodeURIComponent(url.value.tenantId ?? '')}`);
}
const open = (vm: Vm) => go({ vmId: vm.id, tenantId: url.value.tenantId, other: url.value.other });
const close = () => go({ tenantId: url.value.tenantId, other: url.value.other });
</script>

<template>
  <section class="compute">
    <h1>{{ t('areas.compute') }}</h1>
    <div
      v-if="admin"
      class="compute-context"
    >
      <TenantPicker
        :value="tenantName"
        @select="pick"
      />
      <p v-if="canOperate && tenantName">
        {{ t('compute.actingOnTenant', { displayName: tenantName }) }}
      </p>
    </div>
    <div
      v-if="pickedSuspended && tenant.data.value"
      class="nui-banner"
      role="status"
    >
      <span>{{ t('tenantStatus.suspendedAdminBanner', { tenant: tenant.data.value.displayName }) }}</span>
      <a
        v-if="canReadTenants"
        :href="`/tenants/${tenant.data.value.id}`"
        @click="openTenant"
      >{{ t('tenantStatus.openTenant') }}</a>
    </div>
    <EmptyState
      v-if="admin && !url.tenantId && !url.vmId"
      :title="t('compute.chooseTenant')"
    />
    <VmList
      v-else-if="params"
      :rows="rows"
      :loading="list.isPending.value && !list.error.value"
      :error="listError"
      :retryable="listRetryable"
      :can-operate="canOperate"
      :tenant-id="url.tenantId"
      :other="url.other"
      :has-more="list.hasNextPage.value"
      :fetching-more="list.isFetchingNextPage.value"
      @open="open"
      @retry="list.refetch()"
      @load-more="list.fetchNextPage()"
    />
    <VmDrawer
      v-if="url.vmId"
      :key="url.vmId"
      :vm-id="url.vmId"
      :can-operate="canOperate"
      @close="close"
    />
    <ConfirmDialog
      :open="ui.confirming !== null"
      :title="confirmText.title"
      :confirm-label="confirmText.label"
      :danger="ui.confirming?.action === 'stop'"
      @confirm="confirm"
      @cancel="ui.clearConfirm()"
    >
      <p v-if="confirmText.body">
        {{ confirmText.body }}
      </p>
    </ConfirmDialog>
    <div
      class="nui-visually-hidden"
      aria-live="polite"
    >
      {{ ui.announcement }}
    </div>
  </section>
</template>
