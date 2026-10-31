import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { ApiError, configureApiClient } from '@nimbus/api-client';
import type { Me } from '@nimbus/api-client/model';
import { getMe, login, logout } from '@nimbus/api-client/react';
import { createRealtimeClient, eventsUrl } from '@nimbus/realtime';
import { t } from '@nimbus/messages';
import { Button, ToastProvider } from '@nimbus/ui-kit';
import '@nimbus/design-tokens';
import './shell.css';
import { App } from './App';
import { loadManifest, type Manifest } from './manifest';
import { createShellQueryClient } from './query-client';
import { registerFromManifest } from './remotes';
import { createSessionStore } from './session';
import { createSessionBus } from './bus';

const root = createRoot(document.getElementById('root') as HTMLElement);

// customFetch throws ApiError on every non-2xx response, so a resolved call is always the 200 body.
const body = <T,>(res: { data: unknown }) => res.data as T;

// A bad or missing manifest shows an error, never a blank page (SPEC.md §2.2).
function ManifestError() {
  return (
    <main className="content" role="alert">
      <h1>{t('shell.configError')}</h1>
      <Button onClick={() => window.location.reload()}>{t('common.retry')}</Button>
    </main>
  );
}

/** Creates the session store and the shell's query client, boots once, and renders the app. */
function Shell({ manifest }: { manifest: Manifest }) {
  const [{ store, queryClient }] = useState(() => {
    const queryClient = createShellQueryClient((message) => {
      const state = store.getState();
      if (state.status === 'signedIn') state.bus.publish('toast:show', { kind: 'error', message });
    });
    const store = createSessionStore({
      getMe: async () => body<Me>(await getMe()),
      login: async (role) => body<Me>(await login({ role })),
      logout: () => logout(),
      // Strict in development and e2e builds: a remote publishing a non-remote event throws (realtime.md).
      createBus: () => createSessionBus({ strict: import.meta.env.MODE !== 'production' }),
      startRealtime: (bus) => {
        const client = createRealtimeClient({
          bus,
          url: eventsUrl(window.location),
          // WS-5, close 1006: a 401 also reaches onUnauthorized → expire(); anything else means "reconnect".
          checkSession: () => getMe().then(
            () => true,
            (error: unknown) => !(error instanceof ApiError && error.status === 401),
          ),
        });
        client.start();
        return client;
      },
      queryClient,
      location: () => window.location,
    });
    return { store, queryClient };
  });

  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return; // StrictMode runs effects twice in development
    booted.current = true;
    // Every 401 reaches the store; it counts only those after a successful boot as expiry (D3-07).
    configureApiClient({ onUnauthorized: () => store.expire(), responseValidation: import.meta.env.MODE === 'production' ? 'log' : 'throw' });
    void store.boot();
  }, [store]);

  return (
    <QueryClientProvider client={queryClient}>
      <App manifest={manifest} store={store} />
    </QueryClientProvider>
  );
}

loadManifest()
  .then((manifest) => {
    registerFromManifest(manifest);
    root.render(
      <StrictMode>
        <BrowserRouter>
          <ToastProvider>
            <Shell manifest={manifest} />
          </ToastProvider>
        </BrowserRouter>
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    console.error('[nimbus][shell] manifest.invalid', error);
    root.render(<ManifestError />);
  });
