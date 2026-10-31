// Task center states (H6, D4-13): loading, empty, error, no-permission, plus running / failed / mixed.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ApiError } from '@nimbus/api-client';
import type { Permission, Task } from '@nimbus/api-client/model';
import type { SessionSnapshot } from '@nimbus/mf-contract';
import { ConnectionIndicatorView } from './ConnectionIndicator';
import { TaskCenterView } from './TaskCenter';

const NOW = Date.parse('2026-10-31T12:00:00Z');
const session: SessionSnapshot = {
  user: { id: 'u_1', name: 'Tara Admin', email: 'tara@acme.example' },
  role: 'tenant_admin',
  tenant: { id: 't_acme', displayName: 'Acme Corporation', planName: 'Business', status: 'active' },
  permissions: ['vm:read', 'vm:operate', 'bucket:read', 'quota:read', 'task:read'] as Permission[],
};
const task = (id: string, patch: Partial<Task>): Task => ({
  id,
  kind: 'vm.reboot',
  status: 'running',
  progress: 40,
  seq: 1,
  resource: { type: 'vm', id: 'vm_01', name: 'web-01' },
  tenantId: 't_acme',
  error: null,
  createdAt: '2026-10-31T11:55:00Z',
  finishedAt: null,
  ...patch,
});
const running = [task('a', {}), task('b', { kind: 'vm.start', status: 'queued', progress: 0, resource: { type: 'vm', id: 'vm_02', name: 'web-02' } })];
const failed = task('f', {
  status: 'failed',
  progress: 60,
  finishedAt: '2026-10-31T11:00:00Z',
  createdAt: '2026-10-31T10:59:00Z',
  resource: { type: 'vm', id: 'vm_14', name: 'db-02' },
  error: { type: 'about:blank', title: 'Conflict', status: 409, code: 'VM_BUSY', params: { name: 'db-02' } },
});
const provision = task('p', {
  kind: 'tenant.provision',
  status: 'succeeded',
  progress: 100,
  finishedAt: '2026-10-31T08:00:00Z',
  createdAt: '2026-10-31T07:59:00Z',
  resource: { type: 'tenant', id: 't_acme', name: 'acme' },
});

const meta = {
  title: 'shell/TaskCenter',
  component: TaskCenterView,
  args: { session, tasks: [], defaultOpen: true, now: NOW },
  decorators: [(Story) => <div style={{ display: 'flex', justifyContent: 'flex-end', minBlockSize: 420 }}><Story /></div>],
} satisfies Meta<typeof TaskCenterView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = { args: { tasks: undefined } };
export const Empty: Story = { args: { tasks: [] } };
export const Error: Story = { args: { tasks: undefined, error: new ApiError({ title: 'x', status: 500, code: 'INTERNAL' }), onRetry: () => {} } };
/** Without `task:read` the header has no task center (D4-13); the connection indicator stays. */
export const NoPermission: Story = { render: () => <ConnectionIndicatorView state="connected" /> };
export const Running: Story = { args: { tasks: running } };
export const Failed: Story = { args: { tasks: [failed] } };
export const Mixed: Story = { args: { tasks: [...running, failed, provision] } };
export const Closed: Story = { args: { tasks: running, defaultOpen: false } };
export const LongText: Story = {
  args: { tasks: [task('l', { resource: { type: 'vm', id: 'vm_99', name: 'a-very-long-virtual-machine-name-that-wraps-in-the-panel-01' } })] },
};
export const RightToLeft: Story = { args: { tasks: [...running, failed] }, decorators: [(Story) => <div dir="rtl"><Story /></div>] };

export const ConnectionStates: StoryObj = {
  render: () => (
    <div style={{ display: 'grid', gap: 8 }}>
      <ConnectionIndicatorView state="connecting" />
      <ConnectionIndicatorView state="connected" />
      <ConnectionIndicatorView state="reconnecting" />
      <ConnectionIndicatorView state="offline" />
    </div>
  ),
};
