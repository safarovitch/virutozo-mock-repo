<script setup lang="ts">
// Same behaviour as the React Button (§8.2): `loading` ignores clicks; `disabledReason` keeps the button
// focusable with aria-disabled and explains why in a tooltip (RBAC-4, D3-10).
import { useId } from 'vue';

const props = withDefaults(
  defineProps<{ variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; loading?: boolean; disabled?: boolean; disabledReason?: string }>(),
  { variant: 'secondary', loading: false, disabled: false, disabledReason: undefined },
);
const emit = defineEmits<{ click: [event: MouseEvent] }>();
const tooltipId = useId();

function onClick(event: MouseEvent) {
  if (props.loading || props.disabledReason) {
    event.preventDefault();
    return;
  }
  emit('click', event);
}
</script>

<template>
  <span
    v-if="disabledReason"
    class="nui-tooltip-anchor"
  >
    <button
      type="button"
      :class="['nui-button', `nui-button--${variant}`]"
      :disabled="disabled"
      aria-disabled="true"
      :aria-describedby="tooltipId"
      @click="onClick"
    >
      <slot />
    </button>
    <span
      :id="tooltipId"
      role="tooltip"
      class="nui-tooltip"
    >{{ disabledReason }}</span>
  </span>
  <button
    v-else
    type="button"
    :class="['nui-button', `nui-button--${variant}`]"
    :disabled="disabled"
    :aria-disabled="loading || undefined"
    :aria-busy="loading || undefined"
    @click="onClick"
  >
    <span
      v-if="loading"
      class="nui-spinner"
      aria-hidden="true"
    />
    <slot />
  </button>
</template>
