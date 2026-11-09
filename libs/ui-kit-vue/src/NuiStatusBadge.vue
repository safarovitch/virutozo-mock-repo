<script setup lang="ts">
// Icon + text per status, so status is never colour alone (NFR-A11Y-3). Same shapes as the React badge.
import type { StatusTone } from './types';

defineProps<{ tone: StatusTone; label: string }>();
const ICONS: Record<StatusTone, string> = {
  success: 'M3 8l3 3 7-7',
  warning: 'M8 2l6 12H2z',
  danger: 'M4 4l8 8M12 4l-8 8',
  info: 'M8 4v1M8 7v5',
  neutral: 'M3 8h10',
};
</script>

<template>
  <span :class="['nui-badge', `nui-badge--${tone}`]">
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <path :d="ICONS[tone]" />
    </svg>
    <span class="nui-badge__label">{{ label }}</span>
  </span>
</template>
