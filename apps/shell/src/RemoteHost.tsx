import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { MountedRemote, RemoteContext, RootBus, ScopedBus, SessionSnapshot } from '@nimbus/mf-contract';
import { t } from '@nimbus/messages';
import { Button, Skeleton } from '@nimbus/ui-kit';
import type { Manifest, RemoteName } from './manifest';
import { loadRemoteModule } from './remotes';

interface Props {
  name: RemoteName;
  title: string;
  manifest: Manifest;
  bus: RootBus;
  session: SessionSnapshot;
}

/**
 * Loads and mounts one remote (specs/shared/mf-contract.md). A load failure or a mount() that throws
 * shows a contained panel with Retry; the rest of the shell keeps working (MF-4, SPEC-SHL-4).
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
    loadRemoteModule(name, manifest[name], attempt > 0)
      .then((mod) => {
        if (cancelled || !el.current) return;
        mounted.current = mod.mount(el.current, contextFor(path));
        setStatus('mounted');
      })
      .catch((error: unknown) => {
        console.error(`[nimbus][shell] remote.load_failed ${name}`, error);
        if (!cancelled) setStatus('failed');
      });
    return () => {
      cancelled = true;
      mounted.current?.unmount();
      mounted.current = null;
      remoteScope.dispose(); // MF-5
    };
    // Mount once per remote and attempt; path changes go through update() below.
  }, [name, attempt]);

  // Path changes and session changes (a new tenant status, SPEC-SHL-8, D6-14) reach the remote as update(ctx).
  useEffect(() => {
    mounted.current?.update(contextFor(path));
  }, [path, session]);

  return (
    <>
      {status === 'failed' && (
        <div role="alert" className="remote-error">
          <h1>{t('shell.remoteUnavailable', { area: title })}</h1>
          <Button onClick={() => setAttempt((n) => n + 1)}>{t('common.retry')}</Button>
        </div>
      )}
      {status === 'loading' && <Skeleton label={t('common.loading')} />}
      <div ref={el} hidden={status === 'failed'} data-remote={name} />
    </>
  );
}
