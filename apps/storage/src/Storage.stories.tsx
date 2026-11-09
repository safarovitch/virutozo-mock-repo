// Every state of the storage area (H6): the whole area runs against an in-memory API per story. The dialog
// stories open their dialog with a play function in Storybook; the ACs are tested in StorageArea.test.tsx.
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRootBus, type RemoteContext, type SessionSnapshot } from '@nimbus/mf-contract';
import { App } from './App';
import { ACME, GIB, createFakeApi, type FakeApiOptions } from './testing/fake-api';
import { ACME_SUMMARY, PROVIDER, RESELLER, TENANT_ADMIN, TENANT_VIEWER } from './testing/render';

const user = { id: 'u_tadmin', name: 'Tom Admin', email: 'tom@acme.test' };
const TOM: SessionSnapshot = { user, role: 'tenant_admin', tenant: ACME_SUMMARY, permissions: TENANT_ADMIN };
const VIEWER: SessionSnapshot = { ...TOM, role: 'tenant_viewer', permissions: TENANT_VIEWER };
const SUSPENDED: SessionSnapshot = { ...TOM, tenant: { ...ACME_SUMMARY, status: 'suspended' } };
const NO_ACCESS: SessionSnapshot = { ...TOM, permissions: [] };
const ADMIN: SessionSnapshot = { user, role: 'provider_admin', tenant: null, permissions: PROVIDER };
const RESELLER_ADMIN: SessionSnapshot = { user, role: 'reseller_admin', tenant: null, permissions: RESELLER };

const usage = (ratio: number): FakeApiOptions => ({ tenants: [{ ...ACME, storageQuotaBytes: 100 * GIB, storageUsedBytes: Math.round(ratio * 100 * GIB) }] });

function Area({ path = '/', session = TOM, api = {} }: { path?: string; session?: SessionSnapshot; api?: FakeApiOptions }) {
  const [client] = useState(() => {
    globalThis.fetch = createFakeApi(api).fetch;
    return new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  const [current, setPath] = useState(path);
  const [events] = useState(() => createRootBus().scope('storage'));
  const ctx: RemoteContext = {
    basePath: '/storage',
    path: current,
    session,
    events,
    navigate: (to) => {
      if (to.startsWith('/storage')) setPath(to.slice('/storage'.length) || '/');
    },
  };
  return (
    <QueryClientProvider client={client}>
      <App ctx={ctx} />
    </QueryClientProvider>
  );
}

const meta = { title: 'storage/Area' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const story = (props: Parameters<typeof Area>[0]): Story => ({ render: () => <Area {...props} /> });

export const List = story({});
export const UsageOk = story({ api: usage(0.4) });
export const UsageDanger = story({ api: usage(0.97) });
export const UsageOverQuota = story({ api: usage(1.1) });
export const Loading = story({ api: { hang: ['listBuckets', 'getQuotas'] } });
export const Empty = story({ api: { buckets: [] } });
export const EmptyReadOnly = story({ session: VIEWER, api: { buckets: [] } });
export const LoadError = story({ api: { fail: { listBuckets: { status: 500, code: 'INTERNAL' }, getQuotas: { status: 500, code: 'INTERNAL' } } } });
export const NoAccess = story({ session: NO_ACCESS });
export const ReadOnlyViewer = story({ session: VIEWER });
export const TenantSuspended = story({ session: SUSPENDED });
export const AdminChooseTenant = story({ session: ADMIN });
export const AdminTenantList = story({ session: ADMIN, path: '/?tenantId=t_acme' });
export const AdminReseller = story({ session: RESELLER_ADMIN, path: '/?tenantId=t_acme' });
export const AdminSuspendedTenant = story({ session: ADMIN, path: '/?tenantId=t_acme', api: { tenants: [{ ...ACME, status: 'suspended' }] } });
export const AdminForeignTenant = story({ session: RESELLER_ADMIN, path: '/?tenantId=t_foreign' });

export const CreateDialogErrors: Story = {
  render: () => <Area />,
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Create bucket' }));
    const dialog = await within(document.body).findByRole('dialog', { name: 'Create bucket' });
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'My_Bucket');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create bucket' }));
    await expect(within(dialog).getByText('Use 3–63 lowercase letters, numbers, dots and hyphens.')).toBeVisible();
  },
};

export const CreateDialogQuotaFull: Story = {
  render: () => <Area api={usage(1)} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Create bucket' }));
    const dialog = await within(document.body).findByRole('dialog', { name: 'Create bucket' });
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'acme-more');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create bucket' }));
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent('Storage quota is full.');
  },
};

export const DeleteDialog: Story = {
  render: () => <Area />,
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole('button', { name: 'Delete acme-backups' }));
    const dialog = await within(document.body).findByRole('dialog', { name: 'Delete acme-backups?' });
    await userEvent.type(within(dialog).getByRole('textbox'), 'acme-backups');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete bucket' }));
    await expect(await within(dialog).findByRole('alert')).toHaveTextContent('Empty the bucket before deleting it.');
  },
};
