<script setup lang="ts">
// The VM list (SPEC-CMP-1) with its H6 states. A semantic table: at most 200 rows per page (D6-04).
import type { Vm } from '@nimbus/api-client/model';
import { formatBytes } from '@nimbus/format';
import { Button, EmptyState, ErrorState, Skeleton } from '@nimbus/ui-kit-vue';
import { useCtx } from './area';
import { t } from './messages/en';
import { toPath } from './url';
import VmActions from './VmActions.vue';
import VmStatus from './VmStatus.vue';

const props = defineProps<{
  rows: Vm[];
  loading: boolean;
  error?: string;
  canOperate: boolean;
  tenantId?: string;
  other: [string, string][];
  hasMore: boolean;
  fetchingMore: boolean;
}>();
const emit = defineEmits<{ open: [vm: Vm]; retry: []; loadMore: [] }>();
const ctx = useCtx();
const MIB = 1024 * 1024;

const hrefFor = (vm: Vm) => `${ctx.value.basePath}${toPath({ vmId: vm.id, tenantId: props.tenantId, other: props.other })}`;

/** A plain click opens the drawer through the shell; modified clicks keep the browser's behaviour. */
function onNameClick(event: MouseEvent, vm: Vm) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  emit('open', vm);
}
</script>

<template>
  <Skeleton
    v-if="loading"
    :lines="10"
  />
  <ErrorState
    v-else-if="error"
    :message="error"
    @retry="emit('retry')"
  />
  <EmptyState
    v-else-if="rows.length === 0"
    :title="t('compute.empty')"
  />
  <template v-else>
    <table
      class="vm-table"
      :aria-label="t('compute.title')"
    >
      <thead>
        <tr>
          <th scope="col">
            {{ t('compute.columns.name') }}
          </th>
          <th scope="col">
            {{ t('compute.columns.status') }}
          </th>
          <th scope="col">
            {{ t('compute.columns.vcpus') }}
          </th>
          <th scope="col">
            {{ t('compute.columns.memory') }}
          </th>
          <th scope="col">
            {{ t('compute.columns.ip') }}
          </th>
          <th
            v-if="canOperate"
            scope="col"
          >
            {{ t('compute.columns.actions') }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="vm in rows"
          :key="vm.id"
        >
          <th scope="row">
            <a
              :href="hrefFor(vm)"
              @click="onNameClick($event, vm)"
            >{{ vm.name }}</a>
          </th>
          <td>
            <VmStatus :vm="vm" />
          </td>
          <td>{{ vm.vcpus }}</td>
          <td>{{ formatBytes(vm.memoryMiB * MIB) }}</td>
          <td>{{ vm.ip ?? '—' }}</td>
          <td v-if="canOperate">
            <VmActions :vm="vm" />
          </td>
        </tr>
      </tbody>
    </table>
    <Button
      v-if="hasMore"
      :loading="fetchingMore"
      @click="emit('loadMore')"
    >
      {{ t('compute.loadMore') }}
    </Button>
  </template>
</template>
