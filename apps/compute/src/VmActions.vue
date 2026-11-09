<script setup lang="ts">
// Start / Stop / Reboot for one VM, the same in the row and the drawer (D6-12). Callers render this only
// with `vm:operate` (AC-CMP-2.3).
import type { Vm } from '@nimbus/api-client/model';
import { Button } from '@nimbus/ui-kit-vue';
import { ACTIONS, actionState, useActionRules, useActions } from './area';
import { t } from './messages/en';

defineProps<{ vm: Vm }>();
const { blockedReason } = useActionRules();
const actions = useActions();
</script>

<template>
  <div
    role="group"
    class="vm-actions"
    :aria-label="t('compute.actionsFor', { name: vm.name })"
  >
    <Button
      v-for="action in ACTIONS"
      :key="action"
      :variant="action === 'stop' ? 'danger' : 'secondary'"
      :disabled="actionState(vm, action, blockedReason).disabled"
      :disabled-reason="actionState(vm, action, blockedReason).reason"
      @click="actions.request(vm, action)"
    >
      {{ t(`compute.actions.${action}`) }}
    </Button>
  </div>
</template>
