<script setup lang="ts">
// The Compute area root. Without `vm:read` it never renders data (RBAC-5); the shell's 403 page normally
// catches this first (AC-SHL-3.1).
import { computed } from 'vue';
import { Permission } from '@nimbus/api-client/model';
import { can } from '@nimbus/auth';
import { EmptyState } from '@nimbus/ui-kit-vue';
import { useCtx } from './area';
import ComputeArea from './ComputeArea.vue';
import { t } from './messages/en';

const ctx = useCtx();
const canRead = computed(() => can(ctx.value.session, Permission['vm:read']));
</script>

<template>
  <ComputeArea v-if="canRead" />
  <EmptyState
    v-else
    :title="t('shell.noAccess.title')"
    :description="t('shell.noAccess.body')"
  />
</template>
