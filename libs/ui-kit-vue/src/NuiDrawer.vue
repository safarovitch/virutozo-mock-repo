<script setup lang="ts">
// URL-addressable side panel (§8.2): the owner derives `open` from the URL and navigates on `close`.
import Modal from './NuiModal.vue';

defineProps<{ open: boolean; title: string }>();
const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <Modal
    :open="open"
    :title="title"
    drawer
    @close="emit('close')"
  >
    <slot />
  </Modal>
</template>
