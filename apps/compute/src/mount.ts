import { createApp, shallowRef } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { configureApiClient } from '@nimbus/api-client';
import { reportUncaughtErrors, type RemoteContext, type RemoteModule } from '@nimbus/mf-contract';
import '@nimbus/design-tokens';
import '@nimbus/ui-kit-vue';
import RemoteBoundary from './RemoteBoundary.vue';
import { CTX_KEY } from './context';
import { createComputeQueryClient } from './data';
import { BUS_KEY } from './realtime/bus';
import './compute.css';

// The URL prefix of this remote's own code, so it reports only its own uncaught errors (MF-6, D7-17).
const CODE_BASE = new URL(import.meta.env.BASE_URL, import.meta.url).href;

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
  const app = createApp(RemoteBoundary); // root boundary around App (MF-6)
  app.provide(BUS_KEY, initial.events);
  app.provide(CTX_KEY, ctx);
  app.use(createPinia()); // UI state, one store per mount
  app.use(VueQueryPlugin, { queryClient });
  const stopReporting = reportUncaughtErrors('compute', initial.events, CODE_BASE);
  app.mount(el);
  return {
    unmount: () => {
      stopReporting();
      app.unmount();
      queryClient.clear(); // nothing from this session survives a remount (AC-SHL-1.3)
    },
    update: (next) => {
      ctx.value = next;
    },
  };
};
