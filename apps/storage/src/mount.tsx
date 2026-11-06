import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { reportUncaughtErrors, type RemoteContext, type RemoteModule } from '@nimbus/mf-contract';
import '@nimbus/design-tokens';
import { RemoteErrorBoundary } from '@nimbus/ui-kit';
import { App } from './App';

// The URL prefix of this remote's own code, so it reports only its own uncaught errors (MF-6, D7-17).
const CODE_BASE = new URL(import.meta.env.BASE_URL, import.meta.url).href;

// RemoteModule (specs/shared/mf-contract.md): mount once, then re-render on update(ctx).
export const mount: RemoteModule['mount'] = (el, ctx) => {
  // The boundary reports render errors; React's own log would be a second entry (D7-17).
  const root = createRoot(el, { onCaughtError: () => undefined });
  const onError = (error: Error) => ctx.events.publish('remote:error', { remote: 'storage', message: error.message, ...(error.stack ? { stack: error.stack } : {}), fatal: true });
  const stopReporting = reportUncaughtErrors('storage', ctx.events, CODE_BASE);
  const render = (next: RemoteContext) =>
    root.render(
      <StrictMode>
        <RemoteErrorBoundary onError={onError}>
          <App ctx={next} />
        </RemoteErrorBoundary>
      </StrictMode>,
    );
  render(ctx);
  return {
    unmount: () => {
      stopReporting();
      root.unmount();
    },
    update: render,
  };
};
