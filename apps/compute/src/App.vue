<script setup lang="ts">
// Day 1 placeholder (TECH-1). The VM list arrives with SPEC-CMP-1 on Day 6.
import { inject } from 'vue';
import { CTX_KEY } from './context';
import { useBusEvent } from './realtime/useBusEvent';

const ctx = inject(CTX_KEY);
// RT-6: after a reconnect compute invalidates its own active queries. There are none before SPEC-CMP-1
// (Day 6); the subscription is here so unmount cleanup is tested from the start (AC-SHL-6.3, D4-11).
useBusEvent('realtime:reconnected', () => {});
</script>

<template>
  <section>
    <h1>Compute</h1>
    <p>
      Mounted at <code>{{ ctx?.basePath }}</code>
    </p>
  </section>
</template>
