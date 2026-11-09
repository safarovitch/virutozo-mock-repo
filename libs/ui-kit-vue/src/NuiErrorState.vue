<script setup lang="ts">
// A failed load (H6). `message` comes from messageFor(problem), never from server text (MSG-3).
import { t } from '@nimbus/messages';
import Button from './NuiButton.vue';

withDefaults(defineProps<{ message: string; title?: string; retry?: boolean }>(), { title: () => t('common.errorTitle'), retry: true });
const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <section
    class="nui-state nui-state--error"
    role="alert"
  >
    <h2>{{ title }}</h2>
    <p>{{ message }}</p>
    <Button
      v-if="retry"
      @click="emit('retry')"
    >
      {{ t('common.retry') }}
    </Button>
  </section>
</template>
