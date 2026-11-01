// The remote's context for components: the current RemoteContext plus helpers that keep the URL rules
// (specs/shared/url-conventions.md) in one place.
import { createContext, useContext } from 'react';
import type { RemoteContext } from '@nimbus/mf-contract';
import { parsePath, toPath, type TenantsUrl } from './url';

export const CtxContext = createContext<RemoteContext | null>(null);

export function useCtx(): RemoteContext {
  const ctx = useContext(CtxContext);
  if (!ctx) throw new Error('tenants: RemoteContext missing');
  return ctx;
}

/** Navigates within the area. `replace` for corrections and while typing (D5-04). */
export function useGo() {
  const ctx = useCtx();
  return (state: Parameters<typeof toPath>[0], options?: { replace?: boolean }) => {
    const path = toPath(state); // "/", "/?q=acme", "/t_acme?tab=quotas"
    ctx.navigate(`${ctx.basePath}${path.startsWith('/?') || path === '/' ? path.slice(1) : path}`, options);
  };
}

export const useUrl = (planIds?: ReadonlySet<string>): TenantsUrl => parsePath(useCtx().path, planIds);
