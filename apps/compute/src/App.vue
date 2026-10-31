<script setup lang="ts">
// Day 1 placeholder (TECH-1). The VM list arrives with SPEC-CMP-1 on Day 6.
import { inject } from 'vue';
import { CTX_KEY } from './context';

const ctx = inject(CTX_KEY);
</script>

<template>
  <section>
    <h1>Compute</h1>
    <p>
      Mounted at <code>{{ ctx?.basePath }}</code>
    </p>
  </section>
</template>
