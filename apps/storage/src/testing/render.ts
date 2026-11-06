// Mounts the storage remote like the shell does, with a fake API and a navigate that updates ctx.path.
import { vi } from 'vitest';
import { Permission } from '@nimbus/api-client/model';
import type { SessionSnapshot } from '@nimbus/mf-contract';
import { mountRemote, testSession, type MountedForTest } from '@nimbus/test-utils';
import { mount } from '../mount';
import { createFakeApi, type FakeApi } from './fake-api';

export const TENANT_ADMIN: Permission[] = [Permission['bucket:read'], Permission['bucket:create'], Permission['bucket:delete'], Permission['quota:read'], Permission['vm:read']];
export const TENANT_VIEWER: Permission[] = [Permission['bucket:read'], Permission['quota:read'], Permission['vm:read']];
export const PROVIDER: Permission[] = [Permission['tenant:read'], Permission['bucket:read'], Permission['quota:read'], Permission['vm:read'], Permission['vm:operate']];
export const RESELLER: Permission[] = [Permission['tenant:read'], Permission['bucket:read'], Permission['quota:read'], Permission['vm:read']];

export const ACME_SUMMARY = { id: 't_acme', displayName: 'Acme Corporation', planName: 'Business', status: 'active' } as const;

export const tenantSession = (permissions = TENANT_ADMIN, overrides: Partial<SessionSnapshot> = {}) =>
  testSession(permissions, { role: 'tenant_admin', tenant: { ...ACME_SUMMARY }, ...overrides });
export const adminSession = () => testSession(PROVIDER, { role: 'provider_admin', tenant: null });
export const resellerSession = () => testSession(RESELLER, { role: 'reseller_admin', tenant: null });

export interface Rendered {
  remote: MountedForTest;
  api: FakeApi;
  history: { to: string; replace: boolean }[];
}

export function renderArea(path = '/', { session = tenantSession(), api = createFakeApi() }: { session?: SessionSnapshot; api?: FakeApi } = {}): Rendered {
  vi.spyOn(globalThis, 'fetch').mockImplementation(api.fetch);
  const history: Rendered['history'] = [];
  const holder: { remote?: MountedForTest } = {};
  holder.remote = mountRemote(
    { mount },
    {
      source: 'storage',
      basePath: '/storage',
      path,
      session,
      navigate: (to, options) => {
        history.push({ to, replace: Boolean(options?.replace) });
        if (to === '/storage' || to.startsWith('/storage/') || to.startsWith('/storage?')) holder.remote?.update({ path: to.slice('/storage'.length) || '/' });
      },
    },
  );
  return { remote: holder.remote, api, history };
}
