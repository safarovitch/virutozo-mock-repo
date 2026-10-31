import { createApp, shallowRef } from 'vue';
import type { RemoteContext, RemoteModule } from '@nimbus/mf-contract';
import '@nimbus/design-tokens';
import App from './App.vue';
import { CTX_KEY } from './context';

// RemoteModule (specs/shared/mf-contract.md): components read the context from CTX_KEY,
// so update(ctx) only swaps the ref; there's no remount.
export const mount: RemoteModule['mount'] = (el, initial) => {
  const ctx = shallowRef<RemoteContext>(initial);
  const app = createApp(App);
  app.provide(CTX_KEY, ctx);
  app.mount(el);
  return {
    unmount: () => app.unmount(),
    update: (next) => {
      ctx.value = next;
    },
  };
};
