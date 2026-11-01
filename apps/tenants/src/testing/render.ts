// Mounts the tenants remote like the shell does, with a fake API and a navigate that updates ctx.path.
import { vi } from 'vitest';
import { Permission } from '@nimbus/api-client/model';
import { mountRemote, testSession, type MountedForTest } from '@nimbus/test-utils';
import { mount } from '../mount';
import { createFakeApi, type FakeApi } from './fake-api';

export const PROVIDER: Permission[] = [
  Permission['tenant:read'],
  Permission['tenant:create'],
  Permission['tenant:update'],
  Permission['tenant:suspend'],
  Permission['quota:read'],
  Permission['quota:update'],
  Permission['plan:read'],
  Permission['task:read'],
];
export const READ_ONLY: Permission[] = [Permission['tenant:read'], Permission['quota:read'], Permission['plan:read'], Permission['task:read']];

export interface Rendered {
  remote: MountedForTest;
  api: FakeApi;
  /** Every navigate call, oldest first. */
  history: { to: string; replace: boolean }[];
}

export function renderArea(path = '/', { permissions = PROVIDER, api = createFakeApi() }: { permissions?: Permission[]; api?: FakeApi } = {}): Rendered {
  vi.spyOn(globalThis, 'fetch').mockImplementation(api.fetch);
  const history: Rendered['history'] = [];
  const holder: { remote?: MountedForTest } = {};
  holder.remote = mountRemote(
    { mount },
    {
      source: 'tenants',
      basePath: '/tenants',
      path,
      session: testSession(permissions, { role: 'provider_admin', tenant: null }),
      navigate: (to, options) => {
        history.push({ to, replace: Boolean(options?.replace) });
        if (to === '/tenants' || to.startsWith('/tenants/') || to.startsWith('/tenants?')) holder.remote?.update({ path: to.slice('/tenants'.length) || '/' });
      },
    },
  );
  return { remote: holder.remote, api, history };
}
