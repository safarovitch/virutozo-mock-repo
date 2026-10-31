// Routing for the shell (SPEC-SHL-1, SPEC-SHL-2, SPEC-SHL-3). Nothing protected renders before boot
// settles; signed-out visits go to /login with a returnTo; areas without permission show the 403 page.
import { useEffect, useSyncExternalStore } from 'react';
import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router';
import { AREAS, can, homeArea, loginUrl, returnToFor, safeReturnTo } from '@nimbus/auth';
import { SessionProvider } from '@nimbus/auth/react';
import type { RootBus, SessionSnapshot } from '@nimbus/mf-contract';
import { t } from '@nimbus/messages';
import { useToast } from '@nimbus/ui-kit';
import { Layout } from './Layout';
import { LoginPage } from './LoginPage';
import type { Manifest } from './manifest';
import { BootError, BootLoader, NoAccessPage, NotFoundPage } from './pages';
import { RemoteHost } from './RemoteHost';
import type { SessionStore } from './session';

export function App({ manifest, store }: { manifest: Manifest; store: SessionStore }) {
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const location = useLocation();
  const [params] = useSearchParams();

  if (state.status === 'booting') return <BootLoader />;
  if (state.status === 'bootFailed') return <BootError error={state.error} onRetry={() => void store.boot()} />;

  if (location.pathname === '/login') {
    if (state.status === 'signedIn') {
      // After sign-in (or a visit to /login while signed in): returnTo if valid, else home (AC-SHL-1.7/1.8, D3-08).
      const home = homeArea(state.session);
      const target = safeReturnTo(params.get('returnTo'), window.location.origin) ?? (home ? `/${home}` : '/');
      return <Navigate to={target} replace />;
    }
    return <LoginPage onSignIn={async (role) => void (await store.signIn(role))} />;
  }

  if (state.status === 'signedOut') return <Navigate to={state.redirect ?? loginUrl({ returnTo: returnToFor(location) })} replace />;

  return (
    <SessionProvider session={state.session}>
      <BusToasts bus={state.bus} />
      <Layout session={state.session} bus={state.bus} onSignOut={() => void store.signOut()}>
        <AreaRoutes manifest={manifest} session={state.session} bus={state.bus} />
      </Layout>
    </SessionProvider>
  );
}

function AreaRoutes({ manifest, session, bus }: { manifest: Manifest; session: SessionSnapshot; bus: RootBus }) {
  const home = homeArea(session);
  return (
    <Routes>
      <Route path="/" element={home ? <Navigate to={`/${home}`} replace /> : <NoAccessPage home={null} />} />
      {AREAS.map((area) => (
        <Route
          key={area.name}
          path={`/${area.name}/*`}
          element={
            can(session, area.permission) ? (
              <RemoteHost name={area.name} title={t(`areas.${area.name}`)} manifest={manifest} bus={bus} session={session} />
            ) : (
              <NoAccessPage home={home} />
            )
          }
        />
      ))}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

/** Remotes ask the shell for toasts with `toast:show` (specs/shared/realtime.md). */
function BusToasts({ bus }: { bus: RootBus }) {
  const show = useToast();
  useEffect(() => bus.subscribe('toast:show', ({ kind, message }) => show({ tone: kind, message })), [bus, show]);
  return null;
}
