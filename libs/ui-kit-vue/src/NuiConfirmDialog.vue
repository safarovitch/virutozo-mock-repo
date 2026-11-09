<script setup lang="ts">
// Type-to-confirm when `confirmText` is set (§8.2): Confirm stays disabled until the input matches.
import { computed, ref, useId, watch } from 'vue';
import { t } from '@nimbus/messages';
import Button from './NuiButton.vue';
import Modal from './NuiModal.vue';

const props = withDefaults(
  defineProps<{ open: boolean; title: string; confirmLabel: string; danger?: boolean; confirmText?: string; busy?: boolean }>(),
  { danger: false, confirmText: undefined, busy: false },
);
const emit = defineEmits<{ confirm: []; cancel: [] }>();
const typed = ref('');
const inputId = useId();
const matches = computed(() => props.confirmText === undefined || typed.value === props.confirmText);
watch(
  () => props.open,
  (open) => {
    if (!open) typed.value = '';
  },
);
</script>

<template>
  <Modal
    :open="open"
    :title="title"
    @close="emit('cancel')"
  >
    <slot />
    <div
      v-if="confirmText !== undefined"
      class="nui-field"
    >
      <label :for="inputId">{{ t('common.typeToConfirm', { value: confirmText }) }}</label>
      <input
        :id="inputId"
        v-model="typed"
        class="nui-input"
        autocomplete="off"
        spellcheck="false"
      >
    </div>
    <template #footer>
      <Button @click="emit('cancel')">
        {{ t('common.cancel') }}
      </Button>
      <Button
        :variant="danger ? 'danger' : 'primary'"
        :disabled="!matches"
        :loading="busy"
        @click="emit('confirm')"
      >
        {{ confirmLabel }}
      </Button>
    </template>
  </Modal>
</template>
