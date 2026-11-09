import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Permission } from '@nimbus/api-client/model';
import type { SessionSnapshot } from '@nimbus/mf-contract';
import { Can, SessionProvider } from '@nimbus/auth/react';
import { Button } from './Button';
import { DataTable, dataTableColumns, type SortingState } from './DataTable';
import { EmptyState } from './States';
import { StatusBadge } from './StatusBadge';

interface Row {
  id: string;
  name: string;
  status: 'active' | 'suspended';
  vms: number;
}
const rows = (n: number, long = false): Row[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `t_${i}`,
    name: long ? `brave-otter-with-a-really-long-tenant-name-${i}` : `tenant-${String(i).padStart(5, '0')}`,
    status: i % 7 === 0 ? 'suspended' : 'active',
    vms: (i * 13) % 50,
  }));

const col = dataTableColumns<Row>();
const columns = col.columns([
  col.accessor('name', { header: 'Name' }),
  col.accessor('status', { header: 'Status', enableSorting: false, cell: (c) => <StatusBadge tone={c.getValue() === 'active' ? 'success' : 'warning'} label={c.getValue() === 'active' ? 'Active' : 'Suspended'} /> }),
  col.accessor('vms', { header: 'VMs' }),
]);

/** Sorting lives with the caller (the URL in the real app); here it sorts in memory like the server would. */
function TableDemo({ data, loading = false, onRowActivate }: { data: Row[]; loading?: boolean; onRowActivate?: (row: Row) => void }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const sorted = useMemo(() => {
    const s = sorting[0];
    if (!s) return data;
    const key = s.id as keyof Row;
    return [...data].sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (s.desc ? -1 : 1));
  }, [data, sorting]);
  return (
    <DataTable
      label="Tenants"
      columns={columns}
      data={sorted}
      getRowId={(r) => r.id}
      sorting={sorting}
      onSortingChange={setSorting}
      onRowActivate={onRowActivate}
      loading={loading}
      height={320}
      empty={<EmptyState title="No tenants yet" />}
      rowActions={(r) => (
        <Button variant="ghost" aria-label={`Open ${r.name}`}>
          Open
        </Button>
      )}
    />
  );
}

const meta = { title: 'ui-kit/DataTable' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const TenThousandRows: Story = { render: () => <TableDemo data={rows(10_000)} /> };
export const Loading: Story = { render: () => <TableDemo data={[]} loading /> };
export const Empty: Story = { render: () => <TableDemo data={[]} /> };
export const LongText: Story = { render: () => <TableDemo data={rows(20, true)} /> };
export const RightToLeft: Story = { render: () => <TableDemo data={rows(50)} />, decorators: [(S) => <div dir="rtl"><S /></div>] };

export const KeyboardRows: StoryObj<{ onRowActivate: (row: Row) => void }> = {
  name: 'TECH-6: rows are navigable by keyboard and Enter activates a row',
  tags: ['play'],
  args: { onRowActivate: fn() },
  render: (args) => <TableDemo data={rows(10_000)} onRowActivate={args.onRowActivate} />,
  play: async ({ args, canvasElement }) => {
    const grid = within(canvasElement).getByRole('table', { name: 'Tenants' });
    const first = within(grid).getAllByRole('row')[1] as HTMLElement;
    first.focus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await waitFor(() => expect(document.activeElement).toHaveAttribute('aria-rowindex', '4'));
    await userEvent.keyboard('{End}');
    await waitFor(() => expect(document.activeElement).toHaveAttribute('aria-rowindex', '10001'));
    await userEvent.keyboard('{Enter}');
    await expect(args.onRowActivate).toHaveBeenCalledWith(expect.objectContaining({ id: 't_9999' }));
  },
};

export const SortToggle: Story = {
  name: 'TECH-6: a sortable header toggles the sort direction',
  tags: ['play'],
  render: () => <TableDemo data={rows(30)} />,
  play: async ({ canvasElement }) => {
    const grid = within(canvasElement).getByRole('table', { name: 'Tenants' });
    const header = within(grid).getByRole('columnheader', { name: /VMs/ });
    await expect(header).toHaveAttribute('aria-sort', 'none');
    await userEvent.click(within(header).getByRole('button'));
    await expect(header).toHaveAttribute('aria-sort', 'ascending');
    await userEvent.click(within(header).getByRole('button'));
    await expect(header).toHaveAttribute('aria-sort', 'descending');
    await expect(within(grid).getByRole('columnheader', { name: 'Status' })).not.toHaveAttribute('aria-sort');
  },
};

/** Pages of 100 arrive when the end is reached, like `useInfiniteQuery` in the tenants area. */
function InfiniteDemo({ onEndReached, total = 1_000, refreshing = false, hold = false }: { onEndReached?: () => void; total?: number; refreshing?: boolean; hold?: boolean }) {
  const all = useMemo(() => rows(total), [total]);
  const [loaded, setLoaded] = useState(100);
  const [fetching, setFetching] = useState(false);
  const descFirst = useMemo(() => col.columns([col.accessor('name', { header: 'Name' }), col.accessor('vms', { header: 'VMs', sortDescFirst: true })]), []);
  const [sorting, setSorting] = useState<SortingState>([]);
  return (
    <DataTable
      label="Tenants"
      columns={descFirst}
      data={all.slice(0, loaded)}
      getRowId={(r) => r.id}
      rowCount={total}
      sorting={sorting}
      onSortingChange={setSorting}
      height={320}
      refreshing={refreshing}
      fetchingMore={fetching || hold}
      onEndReached={() => {
        onEndReached?.();
        if (hold) return;
        setFetching(true);
        setTimeout(() => {
          setLoaded((n) => Math.min(n + 100, total));
          setFetching(false);
        }, 50);
      }}
    />
  );
}

export const FetchingMore: Story = { render: () => <InfiniteDemo hold /> };
export const Refreshing: Story = { render: () => <InfiniteDemo refreshing /> };

export const EndReached: StoryObj<{ onEndReached: () => void }> = {
  name: 'TECH-6: scrolling to the end asks for the next page once and keeps the DOM small',
  tags: ['play'],
  args: { onEndReached: fn() },
  render: (args) => <InfiniteDemo onEndReached={args.onEndReached} />,
  play: async ({ args, canvasElement }) => {
    const grid = within(canvasElement).getByRole('table', { name: 'Tenants' });
    await expect(grid).toHaveAttribute('aria-rowcount', '1001');
    await expect(args.onEndReached).not.toHaveBeenCalled();
    const scroller = canvasElement.querySelector('.nui-table-scroll') as HTMLElement;
    const firstHeight = scroller.scrollHeight;
    scroller.scrollTop = firstHeight;
    await waitFor(() => expect(args.onEndReached).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(within(grid).queryByRole('status')).toBeNull()); // spinner row gone: page 2 arrived
    await expect(scroller.scrollHeight).toBeGreaterThan(firstHeight);
    scroller.scrollTop = scroller.scrollHeight;
    await waitFor(() => expect(args.onEndReached).toHaveBeenCalledTimes(2));
    await expect(within(grid).getAllByRole('row').length).toBeLessThanOrEqual(60);
  },
};

export const DescFirst: Story = {
  name: 'TECH-6: a sortDescFirst column starts descending and a third click flips it, never unsorted',
  tags: ['play'],
  render: () => <InfiniteDemo total={100} />,
  play: async ({ canvasElement }) => {
    const header = within(canvasElement).getByRole('columnheader', { name: /VMs/ });
    const button = within(header).getByRole('button');
    await userEvent.click(button);
    await expect(header).toHaveAttribute('aria-sort', 'descending');
    await userEvent.click(button);
    await expect(header).toHaveAttribute('aria-sort', 'ascending');
    await userEvent.click(button);
    await expect(header).toHaveAttribute('aria-sort', 'descending');
  },
};

const viewer: SessionSnapshot = { user: { id: 'u_1', name: 'Vera', email: 'v@acme.example' }, role: 'tenant_viewer', tenant: null, permissions: [Permission['vm:read']] };

export const CanGate: Story = {
  name: 'TECH-6: Can renders nothing without the permission',
  tags: ['play'],
  render: () => (
    <SessionProvider session={viewer}>
      <Can permission={Permission['vm:read']}>
        <Button>View VMs</Button>
      </Can>
      <Can permission={Permission['vm:operate']}>
        <Button>Reboot</Button>
      </Can>
    </SessionProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'View VMs' })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Reboot' })).toBeNull();
  },
};
