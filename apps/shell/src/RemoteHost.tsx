import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { MountedRemote, RemoteContext, RootBus, ScopedBus } from '@nimbus/mf-contract';
import type { Manifest, RemoteName } from './manifest';
import { loadRemoteModule } from './remotes';
import { ANONYMOUS_SESSION } from './session';

interface Props {
  name: RemoteName;
  title: string;
  manifest: Manifest;
  bus: RootBus;
}

/**
 * Loads and mounts one remote (specs/shared/mf-contract.md). A load failure or a mount() that throws
 * shows a contained panel with Retry; the rest of the shell keeps working (MF-4, SPEC-SHL-4).
 */
export function RemoteHost({ name, title, manifest, bus }: Props) {
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
    session: ANONYMOUS_SESSION,
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

  useEffect(() => {
    mounted.current?.update(contextFor(path));
  }, [path]);

  return (
    <>
      {status === 'failed' && (
        <div role="alert" className="remote-error">
          <h1>{title} is temporarily unavailable.</h1>
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}
      {status === 'loading' && <p aria-live="polite">Loading {title}…</p>}
      <div ref={el} hidden={status === 'failed'} data-remote={name} />
    </>
  );
}
