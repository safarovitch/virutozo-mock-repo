// The remote's context for components: the current RemoteContext plus helpers that keep the URL rules
// (specs/shared/url-conventions.md) in one place.
import { createContext, useContext } from 'react';
import type { RemoteContext } from '@nimbus/mf-contract';
import { toPath } from './url';

export const CtxContext = createContext<RemoteContext | null>(null);

export function useCtx(): RemoteContext {
  const ctx = useContext(CtxContext);
  if (!ctx) throw new Error('storage: RemoteContext missing');
  return ctx;
}

/** Navigates within the area. `replace` for corrections (url-conventions). */
export function useGo() {
  const ctx = useCtx();
  return (state: Parameters<typeof toPath>[0], options?: { replace?: boolean }) => {
    const path = toPath(state); // "/", "/?tenantId=t_acme"
    ctx.navigate(`${ctx.basePath}${path.startsWith('/?') || path === '/' ? path.slice(1) : path}`, options);
  };
}

