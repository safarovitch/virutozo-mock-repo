import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { createLogger } from '@nimbus/logger';
import type { MountedRemote, RemoteContext, RootBus, ScopedBus, SessionSnapshot } from '@nimbus/mf-contract';
import { t } from '@nimbus/messages';
import { Button, Skeleton } from '@nimbus/ui-kit';
import type { Manifest, RemoteName } from './manifest';
import { loadRemoteModule } from './remotes';

const log = createLogger('shell');

interface Props {
  name: RemoteName;
  title: string;
  manifest: Manifest;
  bus: RootBus;
  session: SessionSnapshot;
}

/**
 * Loads and mounts one remote (specs/shared/mf-contract.md). A load failure, a mount() that throws or a
 * fatal `remote:error` from the remote's own boundary shows a contained panel with Retry; the rest of the
 * shell keeps working (MF-4, MF-6, SPEC-SHL-4). Each occurrence is logged once, naming the remote (D7-18).
 */
export function RemoteHost({ name, title, manifest, bus, session }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mounted = useRef<MountedRemote | null>(null);
  const scope = useRef<ScopedBus | null>(null);
  const [status, setStatus] = useState<'loading' | 'mounted' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  const basePath = `/${name}`;
  const path = (location.pathname.slice(basePath.length) || '/') + location.search + location.hash;

  const contextFor = (p: string): RemoteContext => ({
    basePath,
    path: p,
    session,
    navigate: (to, options) => navigate(to, { replace: options?.replace ?? false }),
    events: scope.current as ScopedBus,
  });

  useEffect(() => {
    let cancelled = false;
    const remoteScope = bus.scope(name);
    scope.current = remoteScope;
    setStatus('loading');
    const teardown = () => {
      mounted.current?.unmount();
      mounted.current = null;
      remoteScope.dispose(); // MF-5
    };
    const offError = bus.subscribe('remote:error', (error, meta) => {
      if (meta.source !== name || error.remote !== name) return;
      if (!error.fatal) {
        log.error('remote.error', { remote: name, message: error.message });
        return;
      }
      log.error('remote.crashed', { remote: name, message: error.message });
      // The remote reports from inside its own render or error hook; unmount it after that returns.
      queueMicrotask(() => {
        if (cancelled) return;
        teardown();
        setStatus('failed');
      });
    });
    loadRemoteModule(name, manifest[name], attempt > 0)
      .then((mod) => {
        if (cancelled || !el.current) return;
        mounted.current = mod.mount(el.current, contextFor(path));
        setStatus((current) => (current === 'loading' ? 'mounted' : current)); // a crash during mount wins
      })
      .catch((error: unknown) => {
        log.error('remote.load_failed', { remote: name, message: error instanceof Error ? error.message : String(error) });
        if (!cancelled) setStatus('failed');
      });
    return () => {
      cancelled = true;
      offError();
      teardown();
    };
    // Mount once per remote and attempt; path changes go through update() below.
  }, [name, attempt]);

  // Path changes and session changes (a new tenant status, SPEC-SHL-8, D6-14) reach the remote as update(ctx).
  useEffect(() => {
    mounted.current?.update(contextFor(path));
  }, [path, session]);

  return (
    <>
      {status === 'failed' && <RemoteUnavailable title={title} onRetry={() => setAttempt((n) => n + 1)} />}
      {status === 'loading' && <Skeleton label={t('common.loading')} />}
      <div ref={el} hidden={status === 'failed'} data-remote={name} />
    </>
  );
}

/** The MF-4 panel, for a load failure and a crash alike (D7-18). */
export function RemoteUnavailable({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div role="alert" className="remote-error">
      <h1>{t('shell.remoteUnavailable', { area: title })}</h1>
      <Button onClick={onRetry}>{t('common.retry')}</Button>
    </div>
  );
}
