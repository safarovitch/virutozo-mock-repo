import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { RemoteContext, RemoteModule } from '@nimbus/mf-contract';
import '@nimbus/design-tokens';
import { App } from './App';

// RemoteModule (specs/shared/mf-contract.md): mount once, then re-render on update(ctx).
export const mount: RemoteModule['mount'] = (el, ctx) => {
  const root = createRoot(el);
  const render = (next: RemoteContext) =>
    root.render(
      <StrictMode>
        <App ctx={next} />
      </StrictMode>,
    );
  render(ctx);
  return { unmount: () => root.unmount(), update: render };
};
