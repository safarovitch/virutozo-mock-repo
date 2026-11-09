import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { configureApiClient } from '@nimbus/api-client';
import { reportUncaughtErrors, type RemoteContext, type RemoteModule } from '@nimbus/mf-contract';
import '@nimbus/design-tokens';
import { RemoteErrorBoundary } from '@nimbus/ui-kit';
import { App } from './App';
import { createStorageQueryClient } from './data';
import './storage.css';

// The URL prefix of this remote's own code, so it reports only its own uncaught errors (MF-6, D7-17).
const CODE_BASE = new URL(import.meta.env.BASE_URL, import.meta.url).href;

// RemoteModule (specs/shared/mf-contract.md): mount once, then re-render on update(ctx).
export const mount: RemoteModule['mount'] = (el, ctx) => {
  // The remote bundles its own api-client: a 401 here tells the shell, which ends the session (SPEC-SHL-1).
  configureApiClient({
    onUnauthorized: () => ctx.events.publish('session:expired', { source: 'storage' }),
    responseValidation: import.meta.env.MODE === 'production' ? 'log' : 'throw',
  });
  const queryClient = createStorageQueryClient(ctx.events); // this area's own cache (MF-2, RT-4)
  // The boundary reports render errors; React's own log would be a second entry (D7-17).
  const root = createRoot(el, { onCaughtError: () => undefined });
  const onError = (error: Error) => ctx.events.publish('remote:error', { remote: 'storage', message: error.message, ...(error.stack ? { stack: error.stack } : {}), fatal: true });
  const stopReporting = reportUncaughtErrors('storage', ctx.events, CODE_BASE);
  const render = (next: RemoteContext) =>
    root.render(
      <StrictMode>
        <RemoteErrorBoundary onError={onError}>
          <QueryClientProvider client={queryClient}>
            <App ctx={next} />
          </QueryClientProvider>
        </RemoteErrorBoundary>
      </StrictMode>,
    );
  render(ctx);
  return {
    unmount: () => {
      stopReporting();
      root.unmount();
      queryClient.clear(); // nothing from this session survives a remount (AC-SHL-1.3)
    },
    update: render,
  };
};
