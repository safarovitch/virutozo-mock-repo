// React permission gate (RBAC-1, AC-SHL-3.3). The session comes from SessionProvider: the shell
// provides the signed-in Me, a React remote provides ctx.session.
import { createContext, useContext, type ReactNode } from 'react';
import type { Permission } from '@nimbus/api-client/model';
import type { SessionSnapshot } from '@nimbus/mf-contract';
import { can } from './index';

const SessionContext = createContext<SessionSnapshot | null>(null);

export function SessionProvider({ session, children }: { session: SessionSnapshot | null; children: ReactNode }) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionSnapshot | null {
  return useContext(SessionContext);
}

/** `const allowed = useCan(Permission['vm:operate'])` */
export function useCan(permission: Permission): boolean {
  return can(useContext(SessionContext), permission);
}

/** Renders its children only with the permission; without a session (before /me resolves) it renders nothing. */
export function Can({ permission, children }: { permission: Permission; children: ReactNode }) {
  return useCan(permission) ? <>{children}</> : null;
}
