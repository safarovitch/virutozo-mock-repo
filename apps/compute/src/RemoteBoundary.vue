<script setup lang="ts">
// The compute remote's root (MF-6, D7-17): every error raised inside its components (setup, render,
// lifecycle hooks, watchers, event handlers) is published once as a fatal remote:error, and nothing
// further renders; the shell unmounts the remote and shows its panel. Vue's `info` string isn't parsed.
import { inject, onErrorCaptured, ref } from 'vue';
import App from './App.vue';
import { BUS_KEY } from './realtime/bus';

const bus = inject(BUS_KEY);
if (!bus) throw new Error('compute: BUS_KEY missing');
const failed = ref(false);

onErrorCaptured((error) => {
  const e = error instanceof Error ? error : new Error(String(error));
  if (!failed.value) bus.publish('remote:error', { remote: 'compute', message: e.message, ...(e.stack ? { stack: e.stack } : {}), fatal: true });
  failed.value = true;
  return false; // handled: Vue's own errorHandler doesn't log it again
});
</script>

<template>
  <App v-if="!failed" />
</template>
