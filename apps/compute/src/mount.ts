import { createApp, shallowRef } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { configureApiClient } from '@nimbus/api-client';
import type { RemoteContext, RemoteModule } from '@nimbus/mf-contract';
import '@nimbus/design-tokens';
import '@nimbus/ui-kit-vue';
import App from './App.vue';
import { CTX_KEY } from './context';
import { createComputeQueryClient } from './data';
import { BUS_KEY } from './realtime/bus';
import './compute.css';

// RemoteModule (specs/shared/mf-contract.md): components read the context from CTX_KEY,
// so update(ctx) only swaps the ref; there's no remount.
export const mount: RemoteModule['mount'] = (el, initial) => {
  // The remote bundles its own api-client: a 401 here tells the shell, which ends the session (SPEC-SHL-1).
  configureApiClient({
    onUnauthorized: () => initial.events.publish('session:expired', { source: 'compute' }),
    responseValidation: import.meta.env.MODE === 'production' ? 'log' : 'throw',
  });
  const ctx = shallowRef<RemoteContext>(initial);
  const queryClient = createComputeQueryClient(); // this area's own cache (MF-2, RT-4)
  const app = createApp(App);
  app.provide(BUS_KEY, initial.events);
  app.provide(CTX_KEY, ctx);
  app.use(createPinia()); // UI state, one store per mount
  app.use(VueQueryPlugin, { queryClient });
  app.mount(el);
  return {
    unmount: () => {
      app.unmount();
      queryClient.clear(); // nothing from this session survives a remount (AC-SHL-1.3)
    },
    update: (next) => {
      ctx.value = next;
    },
  };
};
