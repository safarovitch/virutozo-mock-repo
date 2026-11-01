// Every state of the tenants area (H6): the whole area runs against an in-memory API per story.
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Permission } from '@nimbus/api-client/model';
import { createRootBus, type RemoteContext } from '@nimbus/mf-contract';
import { SessionProvider } from '@nimbus/ui-kit';
import { App } from './App';
import { CtxContext } from './context';
import { TenantListView } from './TenantList';
import { PLANS, createFakeApi, makeTenants, task, type FakeApiOptions } from './testing/fake-api';
import { PROVIDER, READ_ONLY } from './testing/render';
import { parsePath } from './url';

const session = (permissions: Permission[]) => ({ user: { id: 'u_provider', name: 'Alex Provider', email: 'alex@nimbus.test' }, role: 'provider_admin' as const, tenant: null, permissions });

function useStoryCtx(initialPath: string, permissions: Permission[]): RemoteContext {
  const [path, setPath] = useState(initialPath);
  const [events] = useState(() => createRootBus().scope('tenants'));
  return {
    basePath: '/tenants',
    path,
    session: session(permissions),
    navigate: (to) => {
      if (to.startsWith('/tenants')) setPath(to.slice('/tenants'.length) || '/');
    },
    events,
  };
}

/** The whole area, as the shell mounts it, against a fake API (installed once, before the first query). */
function Area({ path = '/', permissions = PROVIDER, api = {} }: { path?: string; permissions?: Permission[]; api?: FakeApiOptions }) {
  const [client] = useState(() => {
    globalThis.fetch = createFakeApi(api).fetch;
    return new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  const ctx = useStoryCtx(path, permissions);
  return (
    <QueryClientProvider client={client}>
      <App ctx={ctx} />
    </QueryClientProvider>
  );
}

/** The list alone, for states that depend on timing (next page, background refetch). */
function ListOnly({ fetchingMore = false, refreshing = false }: { fetchingMore?: boolean; refreshing?: boolean }) {
  const ctx = useStoryCtx('/', PROVIDER);
  const rows = makeTenants(100);
  return (
    <CtxContext.Provider value={ctx}>
      <SessionProvider session={ctx.session}>
        <TenantListView
          url={parsePath('/')}
          rows={rows}
          total={250}
          plans={new Map(PLANS.map((p) => [p.id, p]))}
          plansReady
          loading={false}
          fetchingMore={fetchingMore}
          refreshing={refreshing}
          onRetry={() => undefined}
          height={400}
        />
      </SessionProvider>
    </CtxContext.Provider>
  );
}

const meta = { title: 'tenants/Tenants' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

// ── List (SPEC-TEN-1) ──
export const List: Story = { render: () => <Area /> };
export const ListLoading: Story = { render: () => <Area api={{ hang: ['listTenants'] }} /> };
export const ListEmpty: Story = { render: () => <Area api={{ tenants: [] }} /> };
export const ListNoMatches: Story = { render: () => <Area path="/?q=zzz" /> };
export const ListError: Story = { render: () => <Area api={{ fail: { listTenants: { status: 500, code: 'INTERNAL' } } }} /> };
export const ListNoPermission: Story = { render: () => <Area permissions={[]} /> };
export const ListFetchingMore: Story = { render: () => <ListOnly fetchingMore /> };
export const ListRefreshing: Story = { render: () => <ListOnly refreshing /> };
export const ListPlansUnavailable: Story = { render: () => <Area api={{ fail: { listPlans: { status: 500, code: 'INTERNAL' } } }} /> };

// ── Drawer (SPEC-TEN-3) ──
const suspendedAcme = makeTenants(20).map((t) => (t.id === 't_acme' ? { ...t, status: 'suspended' as const } : t));
export const DrawerOverview: Story = { render: () => <Area path="/t_acme" /> };
export const DrawerLoading: Story = { render: () => <Area path="/t_nope1" api={{ hang: ['getTenant'] }} /> };
export const DrawerNotFound: Story = { render: () => <Area path="/t_nope1" /> };
export const DrawerError: Story = { render: () => <Area path="/t_nope1" api={{ fail: { getTenant: { status: 500, code: 'INTERNAL' } } }} /> };
export const QuotasEditable: Story = { render: () => <Area path="/t_acme?tab=quotas" /> };
export const QuotasReadOnly: Story = { render: () => <Area path="/t_acme?tab=quotas" permissions={READ_ONLY} /> };
export const QuotasSuspended: Story = { render: () => <Area path="/t_acme?tab=quotas" api={{ tenants: suspendedAcme }} /> };
export const QuotasError: Story = { render: () => <Area path="/t_acme?tab=quotas" api={{ fail: { getQuotas: { status: 500, code: 'INTERNAL' } } }} /> };
export const ActivityEmpty: Story = { render: () => <Area path="/t_acme?tab=activity" /> };
export const Activity: Story = {
  render: () => (
    <Area
      path="/t_acme?tab=activity"
      api={{
        tasks: [
          task('task_1', { progress: 60 }),
          task('task_2', { kind: 'tenant.provision', status: 'succeeded', progress: 100, finishedAt: '2026-11-01T08:00:00.000Z', createdAt: '2026-11-01T07:59:00.000Z' }),
          task('task_3', { kind: 'tenant.resume', status: 'failed', progress: 30, error: { title: 'x', status: 500, code: 'INTERNAL' }, finishedAt: '2026-11-01T06:00:00.000Z', createdAt: '2026-11-01T05:59:00.000Z' }),
        ],
      }}
    />
  ),
};
