<script setup lang="ts">
// Native modal <dialog> (NFR-A11Y-4): the page is inert while open, Escape asks the owner to close,
// focus returns to the opener. Same behaviour as the React Modal; shared by ConfirmDialog and Drawer.
import { nextTick, onMounted, ref, useId, watch } from 'vue';
import { t } from '@nimbus/messages';
import Button from './NuiButton.vue';

const props = defineProps<{ open: boolean; title: string; drawer?: boolean }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement | null>(null);
const titleId = useId();
let opener: HTMLElement | null = null;

function sync(open: boolean) {
  const el = dialog.value;
  if (!el) return;
  if (open && !el.open) {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    el.showModal();
  } else if (!open && el.open) {
    el.close();
    void nextTick(() => {
      opener?.focus();
      opener = null;
    });
  }
}
onMounted(() => sync(props.open));
watch(() => props.open, sync);

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  emit('close');
}
</script>

<template>
  <dialog
    ref="dialog"
    :class="drawer ? 'nui-dialog nui-drawer' : 'nui-dialog'"
    :aria-labelledby="titleId"
    @keydown="onKeydown"
    @cancel.prevent
  >
    <template v-if="open">
      <header class="nui-dialog__header">
        <h2 :id="titleId">
          {{ title }}
        </h2>
        <Button
          variant="ghost"
          @click="emit('close')"
        >
          {{ t('common.close') }}
        </Button>
      </header>
      <div class="nui-dialog__body">
        <slot />
      </div>
      <footer
        v-if="$slots.footer"
        class="nui-dialog__footer"
      >
        <slot name="footer" />
      </footer>
    </template>
  </dialog>
</template>
