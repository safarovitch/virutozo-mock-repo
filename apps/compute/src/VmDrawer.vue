<script setup lang="ts">
// VM detail over the list (SPEC-CMP-5, D6-12): Overview, Current task (while one runs), Recent tasks,
// and the same actions as the row. States: loading, not found (AC-CMP-5.2), error.
import { computed } from 'vue';
import type { TaskStatus } from '@nimbus/api-client/model';
import { formatBytes, formatDateTime, formatRelativeTime } from '@nimbus/format';
import { Drawer, EmptyState, ErrorState, ProgressBar, Skeleton, StatusBadge, type StatusTone } from '@nimbus/ui-kit-vue';
import { errorMessage, problemOf, useRecentTasks, useTask, useVm } from './data';
import { t } from './messages/en';
import { isResourceId } from './url';
import VmActions from './VmActions.vue';
import VmStatus from './VmStatus.vue';

const props = defineProps<{ vmId: string; canOperate: boolean }>();
const emit = defineEmits<{ close: [] }>();
const GIB = 1024 ** 3;
const MIB = 1024 ** 2;
const TASK_TONES: Record<TaskStatus, StatusTone> = { queued: 'neutral', running: 'info', succeeded: 'success', failed: 'danger' };

const validId = computed(() => (isResourceId(props.vmId) ? props.vmId : undefined));
const vmQuery = useVm(validId);
const vm = computed(() => vmQuery.data.value);
const currentTask = useTask(() => vm.value?.activeTaskId);
const recent = useRecentTasks(() => (vm.value ? vm.value.id : undefined));

const notFound = computed(() => !validId.value || problemOf(vmQuery.error.value)?.code === 'NOT_FOUND');
const title = computed(() => vm.value?.name ?? props.vmId);
const task = computed(() => (vm.value?.activeTaskId && currentTask.data.value?.id === vm.value.activeTaskId ? currentTask.data.value : undefined));
</script>

<template>
  <Drawer
    :open="true"
    :title="title"
    @close="emit('close')"
  >
    <EmptyState
      v-if="notFound"
      :title="t('errors.NOT_FOUND')"
    />
    <ErrorState
      v-else-if="vmQuery.error.value && !vm"
      :message="errorMessage(vmQuery.error.value)"
      @retry="vmQuery.refetch()"
    />
    <Skeleton
      v-else-if="!vm"
      :lines="6"
    />
    <template v-else>
      <VmActions
        v-if="canOperate"
        :vm="vm"
      />
      <section aria-labelledby="vm-overview">
        <h3 id="vm-overview">
          {{ t('compute.drawer.overview') }}
        </h3>
        <dl class="vm-fields">
          <dt>{{ t('compute.fields.status') }}</dt>
          <dd><VmStatus :vm="vm" /></dd>
          <dt>{{ t('compute.fields.vcpus') }}</dt>
          <dd>{{ vm.vcpus }}</dd>
          <dt>{{ t('compute.fields.memory') }}</dt>
          <dd>{{ formatBytes(vm.memoryMiB * MIB) }}</dd>
          <dt>{{ t('compute.fields.disk') }}</dt>
          <dd>{{ formatBytes(vm.diskGiB * GIB) }}</dd>
          <dt>{{ t('compute.fields.ip') }}</dt>
          <dd>{{ vm.ip ?? '—' }}</dd>
          <dt>{{ t('compute.fields.image') }}</dt>
          <dd>{{ vm.image }}</dd>
          <dt>{{ t('compute.fields.created') }}</dt>
          <dd>{{ formatDateTime(vm.createdAt) }}</dd>
        </dl>
      </section>
      <section
        v-if="vm.activeTaskId"
        aria-labelledby="vm-current-task"
      >
        <h3 id="vm-current-task">
          {{ t('compute.drawer.currentTask') }}
        </h3>
        <ProgressBar
          :label="t('tasks.progressLabel', { kind: t(task ? `taskKind.${task.kind}` : 'tasks.running'), name: vm.name })"
          :value="task ? task.progress / 100 : undefined"
        />
        <p v-if="task">
          {{ t('compute.progress', { percent: task.progress }) }}
        </p>
      </section>
      <section aria-labelledby="vm-recent-tasks">
        <h3 id="vm-recent-tasks">
          {{ t('compute.drawer.recentTasks') }}
        </h3>
        <Skeleton
          v-if="recent.isPending.value && !recent.error.value"
          :lines="3"
        />
        <ErrorState
          v-else-if="recent.error.value"
          :message="errorMessage(recent.error.value)"
          @retry="recent.refetch()"
        />
        <p v-else-if="(recent.data.value?.items.length ?? 0) === 0">
          {{ t('compute.recentTasks.empty') }}
        </p>
        <ul
          v-else
          class="vm-tasks"
        >
          <li
            v-for="item in recent.data.value?.items"
            :key="item.id"
          >
            <span>{{ t(`taskKind.${item.kind}`) }}</span>
            <StatusBadge
              :tone="TASK_TONES[item.status]"
              :label="t(`status.task.${item.status}`)"
            />
            <time :datetime="item.createdAt">{{ formatRelativeTime(item.createdAt) }}</time>
          </li>
        </ul>
      </section>
    </template>
  </Drawer>
</template>
