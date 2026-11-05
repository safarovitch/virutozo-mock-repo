<script setup lang="ts">
// Status badge (icon + text, never colour alone) plus, while an operation runs, a spinner and the task's
// progress % (SPEC-CMP-1, D6-02). The task comes from compute's own cache (RT-4, AC-CMP-1.5).
import { computed } from 'vue';
import type { Vm, VmStatus } from '@nimbus/api-client/model';
import { StatusBadge, type StatusTone } from '@nimbus/ui-kit-vue';
import { isTransitional, useTask } from './data';
import { statusLabel } from './area';
import { t } from './messages/en';

const props = defineProps<{ vm: Vm }>();
const TONES: Record<VmStatus, StatusTone> = { running: 'success', stopped: 'neutral', error: 'danger', starting: 'info', stopping: 'info', rebooting: 'info' };

const task = useTask(() => props.vm.activeTaskId);
const busy = computed(() => isTransitional(props.vm.status) || Boolean(props.vm.activeTaskId));
const progress = computed(() => (props.vm.activeTaskId && task.data.value?.id === props.vm.activeTaskId ? task.data.value.progress : undefined));
</script>

<template>
  <span class="vm-status">
    <span
      v-if="busy"
      class="nui-spinner"
      aria-hidden="true"
    />
    <StatusBadge
      :tone="TONES[vm.status]"
      :label="statusLabel(vm.status)"
    />
    <span
      v-if="busy && progress !== undefined"
      class="vm-status__progress"
    >{{ t('compute.progress', { percent: progress }) }}</span>
  </span>
</template>
