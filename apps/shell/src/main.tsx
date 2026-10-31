import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { createRootBus } from '@nimbus/mf-contract';
import '@nimbus/design-tokens';
import './shell.css';
import { App } from './App';
import { loadManifest } from './manifest';
import { registerFromManifest } from './remotes';

const root = createRoot(document.getElementById('root') as HTMLElement);

// A bad or missing manifest shows an error, never a blank page (SPEC.md §2.2).
function ManifestError() {
  return (
    <main className="content" role="alert">
      <h1>Nimbus Console couldn't load its configuration.</h1>
      <button type="button" onClick={() => window.location.reload()}>
        Retry
      </button>
    </main>
  );
}

loadManifest()
  .then((manifest) => {
    registerFromManifest(manifest);
    // Strict in development and e2e builds: a remote publishing a non-remote event throws (specs/shared/realtime.md).
    const bus = createRootBus({ strict: import.meta.env.MODE !== 'production' });
    root.render(
      <StrictMode>
        <BrowserRouter>
          <App manifest={manifest} bus={bus} />
        </BrowserRouter>
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    console.error('[nimbus][shell] manifest.invalid', error);
    root.render(<ManifestError />);
  });
