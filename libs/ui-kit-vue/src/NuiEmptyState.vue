<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>

<template>
  <section
    class="nui-state"
    :aria-label="title"
  >
    <h2>{{ title }}</h2>
    <p v-if="description">
      {{ description }}
    </p>
    <slot name="action" />
  </section>
</template>
