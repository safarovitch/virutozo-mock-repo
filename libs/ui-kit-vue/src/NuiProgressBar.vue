<script setup lang="ts">
// Determinate when `value` (0–1) is given, indeterminate otherwise (§8.2).
import { computed } from 'vue';

const props = defineProps<{ label: string; value?: number }>();
const percent = computed(() => (props.value === undefined ? undefined : Math.round(Math.min(Math.max(props.value, 0), 1) * 100)));
</script>

<template>
  <div
    role="progressbar"
    class="nui-progress"
    :aria-label="label"
    :aria-valuemin="percent === undefined ? undefined : 0"
    :aria-valuemax="percent === undefined ? undefined : 100"
    :aria-valuenow="percent"
  >
    <div
      :class="percent === undefined ? 'nui-progress__fill nui-progress__fill--indeterminate' : 'nui-progress__fill'"
      :style="percent === undefined ? undefined : { inlineSize: `${percent}%` }"
    />
  </div>
</template>
