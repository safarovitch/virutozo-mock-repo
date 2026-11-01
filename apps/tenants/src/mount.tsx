import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { configureApiClient } from '@nimbus/api-client';
import type { RemoteContext, RemoteModule } from '@nimbus/mf-contract';
import '@nimbus/design-tokens';
import '@nimbus/ui-kit';
import { App } from './App';
import { createTenantsQueryClient } from './data';
import './tenants.css';

// RemoteModule (specs/shared/mf-contract.md): mount once, then re-render on update(ctx).
export const mount: RemoteModule['mount'] = (el, ctx) => {
  // The remote bundles its own api-client: a 401 here tells the shell, which ends the session (SPEC-SHL-1).
  configureApiClient({
    onUnauthorized: () => ctx.events.publish('session:expired', { source: 'tenants' }),
    responseValidation: import.meta.env.MODE === 'production' ? 'log' : 'throw',
  });
  const queryClient = createTenantsQueryClient(ctx.events); // this area's own cache (MF-2, RT-4)
  const root = createRoot(el);
  const render = (next: RemoteContext) =>
    root.render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <App ctx={next} />
        </QueryClientProvider>
      </StrictMode>,
    );
  render(ctx);
  return {
    unmount: () => {
      root.unmount();
      queryClient.clear(); // nothing from this session survives a remount (AC-SHL-1.3)
    },
    update: render,
  };
};
