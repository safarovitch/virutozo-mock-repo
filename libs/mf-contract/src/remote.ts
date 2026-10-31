// The framework-agnostic remote contract (specs/shared/mf-contract.md, ADR-0002).
import type { ScopedBus } from './event-bus';
import type { Permission, Role, TenantSummary } from './model';

/** Plain frozen data derived from `Me`. */
export interface SessionSnapshot {
  readonly user: { readonly id: string; readonly name: string; readonly email: string };
  readonly role: Role; // display only (RBAC-1)
  readonly tenant: Readonly<TenantSummary> | null;
  readonly permissions: readonly Permission[];
}

export interface RemoteContext {
  /** e.g. "/compute" */
  basePath: string;
  /** Current path below basePath, with search and hash, e.g. "/t_acme?tab=quotas". */
  path: string;
  session: SessionSnapshot;
  /** The shell owns the URL. `replace` = no new history entry. */
  navigate: (to: string, options?: { replace?: boolean }) => void;
  /** This remote's scope of the root bus. */
  events: ScopedBus;
}

export interface MountedRemote {
  unmount(): void;
  update(ctx: RemoteContext): void;
}

export interface RemoteModule {
  mount(el: HTMLElement, ctx: RemoteContext): MountedRemote;
}
