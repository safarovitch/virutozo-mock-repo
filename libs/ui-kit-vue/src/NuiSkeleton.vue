<script setup lang="ts">
import { t } from '@nimbus/messages';

withDefaults(defineProps<{ lines?: number; label?: string }>(), { lines: 3, label: () => t('common.loading') });
</script>

<template>
  <div
    class="nui-skeleton"
    role="status"
    aria-busy="true"
    :aria-label="label"
  >
    <div
      v-for="i in lines"
      :key="i"
      class="nui-skeleton__line"
      aria-hidden="true"
      :style="{ inlineSize: `${100 - (((i - 1) * 17) % 40)}%` }"
    />
  </div>
</template>
