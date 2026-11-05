// Every state of the compute area (H6): the whole remote, mounted as the shell mounts it, against an
// in-memory API per story. Render functions only (jsdom loads Vue's runtime-only build).
import { defineComponent, h, onMounted, onUnmounted, ref } from 'vue';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { Permission } from '@nimbus/api-client/model';
import { createRootBus, type MountedRemote, type RemoteContext, type SessionSnapshot } from '@nimbus/mf-contract';
import { mount } from './mount';
import { createFakeApi, makeVms, task, type FakeApiOptions } from './testing/fake-api';

const ACME = { id: 't_acme', displayName: 'Acme Corporation', planName: 'Business', status: 'active' } as const;
const user = { id: 'u_tadmin', name: 'Tom Admin', email: 'tom@acme.test' };
const TENANT_ADMIN: SessionSnapshot = { user, role: 'tenant_admin', tenant: ACME, permissions: [Permission['vm:read'], Permission['vm:operate'], Permission['task:read']] };
const VIEWER: SessionSnapshot = { ...TENANT_ADMIN, role: 'tenant_viewer', permissions: [Permission['vm:read'], Permission['task:read']] };
const SUSPENDED: SessionSnapshot = { ...TENANT_ADMIN, tenant: { ...ACME, status: 'suspended' } };
const PROVIDER: SessionSnapshot = { user, role: 'provider_admin', tenant: null, permissions: [Permission['tenant:read'], Permission['vm:read'], Permission['vm:operate']] };
const NO_ACCESS: SessionSnapshot = { ...TENANT_ADMIN, permissions: [Permission['bucket:read']] };

const busy = makeVms().map((vm, i) => (i < 3 ? { ...vm, status: 'rebooting' as const, activeTaskId: `task_${i}` } : vm));
const busyTasks = [0, 1, 2].map((i) => task(`task_${i}`, { progress: 20 + i * 30, resource: { type: 'vm', id: busy[i]?.id ?? '', name: busy[i]?.name ?? '' } }));

function area(name: string, { path = '/', session = TENANT_ADMIN, api = {} }: { path?: string; session?: SessionSnapshot; api?: FakeApiOptions }) {
  return defineComponent({
    name,
    setup() {
      const el = ref<HTMLElement | null>(null);
      let remote: MountedRemote | undefined;
      onMounted(() => {
        globalThis.fetch = createFakeApi(api).fetch;
        let ctx: RemoteContext = {
          basePath: '/compute',
          path,
          session,
          events: createRootBus().scope('compute'),
          navigate: (to) => {
            if (!to.startsWith('/compute')) return;
            ctx = { ...ctx, path: to.slice('/compute'.length) || '/' };
            remote?.update(ctx);
          },
        };
        remote = mount(el.value as HTMLElement, ctx);
      });
      onUnmounted(() => remote?.unmount());
      return () => h('div', { ref: el });
    },
  });
}

const meta = { title: 'compute/Area' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const story = (...args: Parameters<typeof area>): Story => ({ render: () => area(...args) });

export const List = story('List', {});
export const Loading = story('Loading', { api: { hang: ['listVms'] } });
export const Empty = story('Empty', { api: { vms: [] } });
export const LoadError = story('LoadError', { api: { fail: { listVms: { status: 500, code: 'INTERNAL' } } } });
export const NoAccess = story('NoAccess', { session: NO_ACCESS });
export const ReadOnlyViewer = story('ReadOnlyViewer', { session: VIEWER });
export const OperationsInProgress = story('OperationsInProgress', { api: { vms: busy, tasks: busyTasks } });
export const TenantSuspended = story('TenantSuspended', { session: SUSPENDED });
export const AdminChooseTenant = story('AdminChooseTenant', { session: PROVIDER });
export const AdminTenantList = story('AdminTenantList', { session: PROVIDER, path: '/?tenantId=t_acme' });
export const Drawer = story('Drawer', { path: '/vm_01', api: { tasks: [task('task_old', { status: 'succeeded', progress: 100, kind: 'vm.start' })] } });
export const DrawerWithTask = story('DrawerWithTask', { path: '/vm_01', api: { vms: busy, tasks: busyTasks } });
export const DrawerLoading = story('DrawerLoading', { path: '/vm_01', api: { hang: ['listVms', 'getVm'] } });
export const DrawerNotFound = story('DrawerNotFound', { path: '/vm_99' });
export const DrawerError = story('DrawerError', { path: '/vm_01', api: { hang: ['listVms'], fail: { getVm: { status: 500, code: 'INTERNAL' } } } });
