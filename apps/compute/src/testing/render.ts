// Mounts the compute remote like the shell does, with a fake API and a navigate that updates ctx.path.
import { vi } from 'vitest';
import { Permission } from '@nimbus/api-client/model';
import type { SessionSnapshot } from '@nimbus/mf-contract';
import { mountRemote, testSession, type MountedForTest } from '@nimbus/test-utils';
import { mount } from '../mount';
import { createFakeApi, type FakeApi } from './fake-api';

export const TENANT_ADMIN: Permission[] = [Permission['vm:read'], Permission['vm:operate'], Permission['bucket:read'], Permission['task:read']];
export const TENANT_VIEWER: Permission[] = [Permission['vm:read'], Permission['bucket:read'], Permission['task:read']];
export const PROVIDER: Permission[] = [Permission['tenant:read'], Permission['vm:read'], Permission['vm:operate'], Permission['task:read']];

export const RESELLER: Permission[] = [Permission['tenant:read'], Permission['vm:read'], Permission['task:read']];

export const ACME_SUMMARY = { id: 't_acme', displayName: 'Acme Corporation', planName: 'Business', status: 'active' } as const;

export const tenantSession = (permissions = TENANT_ADMIN, overrides: Partial<SessionSnapshot> = {}) =>
  testSession(permissions, { role: 'tenant_admin', tenant: { ...ACME_SUMMARY }, ...overrides });
export const adminSession = (permissions = PROVIDER) => testSession(permissions, { role: 'provider_admin', tenant: null });
export const resellerSession = () => testSession(RESELLER, { role: 'reseller_admin', tenant: null });

export interface Rendered {
  remote: MountedForTest;
  api: FakeApi;
  /** Every navigate call, oldest first. */
  history: { to: string; replace: boolean }[];
}

export function renderArea(path = '/', { session = tenantSession(), api = createFakeApi() }: { session?: SessionSnapshot; api?: FakeApi } = {}): Rendered {
  vi.spyOn(globalThis, 'fetch').mockImplementation(api.fetch);
  const history: Rendered['history'] = [];
  const holder: { remote?: MountedForTest } = {};
  holder.remote = mountRemote(
    { mount },
    {
      source: 'compute',
      basePath: '/compute',
      path,
      session,
      navigate: (to, options) => {
        history.push({ to, replace: Boolean(options?.replace) });
        if (to === '/compute' || to.startsWith('/compute/') || to.startsWith('/compute?')) holder.remote?.update({ path: to.slice('/compute'.length) || '/' });
      },
    },
  );
  return { remote: holder.remote, api, history };
}
