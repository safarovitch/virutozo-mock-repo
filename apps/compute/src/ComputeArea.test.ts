// The compute area as the shell mounts it, against the in-memory API (SPEC-CMP-1, -2, -5, SPEC-SHL-8 and
// the Day 6 part of SPEC-CMP-4).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import type { Vm } from '@nimbus/api-client/model';
import { Permission } from '@nimbus/api-client/model';
import { testSession } from '@nimbus/test-utils';
import { ACME, createFakeApi, makeVms, task } from './testing/fake-api';
import { ACME_SUMMARY, TENANT_VIEWER, adminSession, renderArea, tenantSession, type Rendered } from './testing/render';

let current: Rendered | undefined;
const render = (...args: Parameters<typeof renderArea>) => (current = renderArea(...args));
afterEach(() => {
  current?.remote.unmount();
  current = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const table = () => screen.findByRole('table', { name: 'Virtual machines' });
const rowOf = async (name: string) => {
  const cell = await within(await table()).findByRole('rowheader', { name });
  return cell.closest('tr') as HTMLElement;
};
/** The text of the element's aria-describedby targets (its tooltip). */
const description = (el: HTMLElement) =>
  (el.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean).map((id) => document.getElementById(id)?.textContent?.trim() ?? '').join(' ');
const toasts = (r: Rendered) => r.remote.fake.published.filter((p) => p.type === 'toast:show').map((p) => p.payload as { kind: string; message: string });
const vmEvent = (vm: Pick<Vm, 'id' | 'status'> & Partial<Vm>) => ({ vm: { ip: null, activeTaskId: null, ...vm } });
const busyVms = () => makeVms().map((vm) => (vm.id === 'vm_01' ? { ...vm, status: 'rebooting' as const, activeTaskId: 'task_1' } : vm));

describe('SPEC-CMP-1 VM list', () => {
  it('NFR-A11Y-3: the list shows name, status as text, vCPU, memory and IP for every VM of the tenant', async () => {
    render();
    const row = await rowOf('web-01');
    expect(row.textContent).toContain('Running');
    expect(row.textContent).toContain('1 GiB');
    expect(row.textContent).toContain('10.0.0.1');
    expect(within(await rowOf('web-04')).getByText('—')).toBeTruthy(); // stopped: no IP
    expect(within(await table()).getAllByRole('row')).toHaveLength(41);
  });

  it('AC-CMP-1.1: a vm.updated event updates the row within one animation frame, with no request', async () => {
    const r = render();
    await rowOf('web-01');
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
    const before = r.api.requests.length;
    r.remote.fake.emit('server:vm.updated', vmEvent({ id: 'vm_01', status: 'stopped' }));
    vi.advanceTimersToNextFrame();
    await waitFor(async () => expect((await rowOf('web-01')).textContent).toContain('Stopped'));
    expect(r.api.requests.length).toBe(before);
  });

  it('AC-CMP-1.3: after a reconnect the list is refetched once, and the open drawer refetches its VM and tasks once', async () => {
    const r = render('/vm_01');
    await screen.findByRole('heading', { name: 'web-01' });
    await screen.findByText('No tasks for this VM in the last 24 hours.');
    const counts = () => [r.api.count('/api/vms'), r.api.count('/api/vms/vm_01'), r.api.count('/api/tasks')];
    const [vms, vm, tasks] = counts() as [number, number, number];
    r.remote.fake.emit('realtime:reconnected', { downtimeMs: 3000 });
    await waitFor(() => expect(counts()).toEqual([vms + 1, vm + 1, tasks + 1]));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(counts()).toEqual([vms + 1, vm + 1, tasks + 1]);
  });

  it('AC-CMP-1.4: status changes are announced politely, at most one announcement per second', async () => {
    const r = render();
    await rowOf('web-01');
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout'] });
    const region = document.querySelector('[aria-live="polite"]') as HTMLElement;
    r.remote.fake.emit('server:vm.updated', vmEvent({ id: 'vm_01', status: 'stopped' }));
    vi.advanceTimersToNextFrame();
    await vi.waitFor(() => expect(region.textContent).toContain('web-01 is now stopped.'));
    for (const id of ['vm_02', 'vm_03', 'vm_05', 'vm_06', 'vm_07']) {
      r.remote.fake.emit('server:vm.updated', vmEvent({ id, status: 'stopping' }));
      vi.advanceTimersToNextFrame();
    }
    await Promise.resolve();
    expect(region.textContent?.trim()).toBe('web-01 is now stopped.'); // nothing new inside the second
    vi.advanceTimersByTime(1000);
    await vi.waitFor(() =>
      expect(region.textContent).toContain('web-02 is now stopping. web-03 is now stopping. web-05 is now stopping. 2 more VMs changed status.'),
    );
  });

  it('AC-CMP-1.5: mounting while a VM has an activeTaskId shows its progress after one getTask call', async () => {
    const r = render('/', { api: createFakeApi({ vms: busyVms(), tasks: [task('task_1', { progress: 40 })] }) });
    const row = await rowOf('web-01');
    await waitFor(() => expect(row.textContent).toContain('Rebooting'));
    await waitFor(() => expect(row.textContent).toContain('40%'));
    expect(r.api.count('/api/tasks/task_1')).toBe(1);
  });

  it('MSG-1: a tenant without VMs sees the compute.empty state', async () => {
    render('/', { api: createFakeApi({ vms: [] }) });
    expect(await screen.findByRole('heading', { name: 'No virtual machines yet' })).toBeTruthy();
  });

  it('MSG-3: a failed load shows the mapped message and Retry loads again', async () => {
    const api = createFakeApi({ fail: { listVms: { status: 500, code: 'INTERNAL' } } });
    render('/', { api });
    expect(await screen.findByText('Something went wrong on our side. Try again.')).toBeTruthy();
    const before = api.count('/api/vms');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(api.count('/api/vms')).toBe(before + 1));
  });

  it('RBAC-5: without vm:read the area renders no data and makes no request', async () => {
    const r = render('/', { session: testSession([Permission['bucket:read']]) });
    expect(await screen.findByRole('heading', { name: '403 – No access' })).toBeTruthy();
    expect(r.api.requests).toHaveLength(0);
  });
});

describe('SPEC-CMP-2 VM actions', () => {
  it('AC-CMP-2.1: Reboot shows rebooting at once, then the task\'s progress from events', async () => {
    const r = render();
    const row = await rowOf('web-01');
    await userEvent.click(within(row).getByRole('button', { name: 'Reboot' }));
    expect(row.textContent).toContain('Rebooting'); // optimistic, before the 202
    await waitFor(() => expect(r.remote.fake.published.some((p) => p.type === 'task:started')).toBe(true));
    const started = r.remote.fake.published.find((p) => p.type === 'task:started')?.payload as { task: { id: string } };
    r.remote.fake.emit('server:task.updated', { task: task(started.task.id, { seq: 3, progress: 60 }) });
    await waitFor(() => expect(row.textContent).toContain('60%'));
    expect(r.api.requests.filter((q) => q.method === 'POST')[0]?.body).toEqual({ action: 'reboot' });
  });

  it('AC-CMP-2.2: a failed task reverts to the server\'s latest status and shows the error toast', async () => {
    const r = render();
    const row = await rowOf('web-01');
    await userEvent.click(within(row).getByRole('button', { name: 'Reboot' }));
    await waitFor(() => expect(r.remote.fake.published.some((p) => p.type === 'task:started')).toBe(true));
    const id = (r.remote.fake.published.find((p) => p.type === 'task:started')?.payload as { task: { id: string } }).task.id;
    // mock-data §7: the final task.updated, then the vm.updated that restores the VM.
    r.remote.fake.emit('server:task.updated', { task: task(id, { seq: 9, status: 'failed', error: { title: 'x', status: 409, code: 'VM_BUSY' } }) });
    r.remote.fake.emit('server:vm.updated', vmEvent({ id: 'vm_01', status: 'running', ip: '10.0.0.1' }));
    await waitFor(() => expect(row.textContent).toContain('Running'));
    expect(row.textContent).not.toContain('%');
    expect(toasts(r)).toContainEqual(expect.objectContaining({ kind: 'error', message: 'web-01 is busy with another operation.' }));
  });

  it('MSG-1: a successful task shows its compute.toast.* message once', async () => {
    const r = render();
    const row = await rowOf('web-04');
    await userEvent.click(within(row).getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(r.remote.fake.published.some((p) => p.type === 'task:started')).toBe(true));
    const id = (r.remote.fake.published.find((p) => p.type === 'task:started')?.payload as { task: { id: string } }).task.id;
    const done = task(id, { kind: 'vm.start', seq: 7, status: 'succeeded', progress: 100, resource: { type: 'vm', id: 'vm_04', name: 'web-04' } });
    r.remote.fake.emit('server:task.updated', { task: done });
    r.remote.fake.emit('server:task.updated', { task: done });
    expect(toasts(r).filter((t) => t.kind === 'success').map((t) => t.message)).toEqual(['web-04 started.']);
  });

  it('AC-CMP-2.3: a tenant_viewer gets no action buttons', async () => {
    render('/', { session: tenantSession(TENANT_VIEWER, { role: 'tenant_viewer' }) });
    await table();
    expect(screen.queryByRole('button', { name: /^(Start|Stop|Reboot)$/ })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).toBeNull();
  });

  it('AC-CMP-2.4: while a VM has an active task every action is disabled with tooltip compute.operationInProgress', async () => {
    render('/', { api: createFakeApi({ vms: busyVms(), tasks: [task('task_1')] }) });
    const row = await rowOf('web-01');
    for (const name of ['Start', 'Stop', 'Reboot']) {
      const button = within(row).getByRole('button', { name });
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(description(button)).toBe('Operation in progress');
    }
  });

  it('AC-CMP-2.5: Stop asks for confirmation; Cancel sends nothing', async () => {
    const r = render();
    const row = await rowOf('web-01');
    await userEvent.click(within(row).getByRole('button', { name: 'Stop' }));
    const dialog = await screen.findByRole('dialog', { name: 'Stop web-01?' });
    expect(dialog.textContent).toContain('Anything running on web-01 will stop.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(r.api.count('/api/vms/vm_01/actions', 'POST')).toBe(0);
    await userEvent.click(within(row).getByRole('button', { name: 'Stop' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Stop web-01?' })).getByRole('button', { name: 'Stop' }));
    await waitFor(() => expect(r.api.count('/api/vms/vm_01/actions', 'POST')).toBe(1));
    expect(row.textContent).toContain('Stopping');
  });

  it('AC-CMP-2.6: a 409 VM_BUSY rolls back, shows errors.VM_BUSY and fetches the VM again', async () => {
    const api = createFakeApi();
    const r = render('/', { api });
    const row = await rowOf('web-01');
    (api.vms[0] as Vm).activeTaskId = 'task_elsewhere'; // another tab started something; this row is stale
    await userEvent.click(within(row).getByRole('button', { name: 'Reboot' }));
    await waitFor(() => expect(toasts(r)).toContainEqual(expect.objectContaining({ kind: 'error', message: 'web-01 is busy with another operation.' })));
    await waitFor(() => expect(api.count('/api/vms/vm_01')).toBe(1));
    await waitFor(() => expect(description(within(row).getByRole('button', { name: 'Reboot' }))).toBe('Operation in progress'));
  });

  it('AC-CMP-2.7: a VM in error has every action disabled with tooltip compute.vmInError', async () => {
    render();
    const row = await rowOf('cache-04');
    for (const name of ['Start', 'Stop', 'Reboot']) expect(description(within(row).getByRole('button', { name }))).toBe('No actions are available while this VM is in error.');
  });
});

describe('SPEC-CMP-5 VM drawer', () => {
  it('AC-CMP-5.1: /compute/vm_01 opens the drawer for web-01 over the list', async () => {
    render('/vm_01');
    const drawer = await screen.findByRole('dialog', { name: 'web-01' });
    await waitFor(() => expect(drawer.textContent).toContain('ubuntu-24.04'));
    expect(drawer.textContent).toContain('IP address');
    expect(await table()).toBeTruthy();
  });

  it('AC-CMP-5.2: an unknown VM ID shows errors.NOT_FOUND', async () => {
    render('/vm_99');
    const drawer = await screen.findByRole('dialog');
    expect(await within(drawer).findByText('This item no longer exists.')).toBeTruthy();
  });

  it('AC-CMP-5.3: a running task\'s progress updates live in the drawer', async () => {
    const r = render('/vm_01', { api: createFakeApi({ vms: busyVms(), tasks: [task('task_1', { progress: 20 })] }) });
    const drawer = await screen.findByRole('dialog', { name: 'web-01' });
    const bar = await within(drawer).findByRole('progressbar', { name: 'Reboot VM: web-01' });
    await waitFor(() => expect(bar.getAttribute('aria-valuenow')).toBe('20'));
    r.remote.fake.emit('server:task.updated', { task: task('task_1', { seq: 4, progress: 70 }) });
    await waitFor(() => expect(bar.getAttribute('aria-valuenow')).toBe('70'));
  });

  it('AC-CMP-5.1: opening a row pushes /compute/:vmId; closing pushes the list URL', async () => {
    const r = render();
    await userEvent.click(within(await rowOf('web-02')).getByRole('link', { name: 'web-02' }));
    const drawer = await screen.findByRole('dialog', { name: 'web-02' });
    await userEvent.click(within(drawer).getByRole('button', { name: 'Close' }));
    expect(r.history).toEqual([
      { to: '/compute/vm_02', replace: false },
      { to: '/compute', replace: false },
    ]);
  });
});

describe('SPEC-CMP-4 admin plumbing (D6-01)', () => {
  it('AC-CMP-5.4: a provider_admin opening /compute/vm_01 without tenantId ends on ?tenantId=t_acme with acme\'s list', async () => {
    const r = render('/vm_01', { session: adminSession() });
    await waitFor(() => expect(r.history).toContainEqual({ to: '/compute/vm_01?tenantId=t_acme', replace: true }));
    expect(await rowOf('web-12')).toBeTruthy();
    expect(r.api.requests.find((q) => q.url.pathname === '/api/vms')?.url.searchParams.get('tenantId')).toBe('t_acme');
  });

  it('MSG-1: an admin without a tenant sees compute.chooseTenant and nothing is listed', async () => {
    const r = render('/', { session: adminSession() });
    expect(await screen.findByRole('heading', { name: 'Choose a tenant to see its virtual machines.' })).toBeTruthy();
    expect(r.api.count('/api/vms')).toBe(0);
  });

  it('AC-CMP-4.3: a provider_admin\'s Stop asks for confirmation naming the tenant', async () => {
    const r = render('/?tenantId=t_acme', { session: adminSession() });
    await userEvent.click(within(await rowOf('web-01')).getByRole('button', { name: 'Stop' }));
    expect(await screen.findByRole('dialog', { name: 'Stop web-01 on tenant Acme Corporation?' })).toBeTruthy();
    expect(r.api.count('/api/vms/vm_01/actions', 'POST')).toBe(0);
  });

  it('AC-CMP-4.3: every admin action asks first, Start and Reboot included', async () => {
    const r = render('/?tenantId=t_acme', { session: adminSession() });
    await userEvent.click(within(await rowOf('web-01')).getByRole('button', { name: 'Reboot' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reboot web-01 on tenant Acme Corporation?' });
    expect(r.api.count('/api/vms/vm_01/actions', 'POST')).toBe(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reboot' }));
    await waitFor(() => expect(r.api.count('/api/vms/vm_01/actions', 'POST')).toBe(1));
  });

  it('AC-CMP-4.7: a tenant_admin opening ?tenantId=t_other sees their own VMs and tenantId is removed', async () => {
    const r = render('/?tenantId=t_other');
    expect(r.history).toEqual([{ to: '/compute', replace: true }]);
    expect(await rowOf('web-01')).toBeTruthy();
    expect(r.api.requests.every((q) => !q.url.searchParams.has('tenantId'))).toBe(true);
  });
});

describe('SPEC-SHL-8 tenant context in compute', () => {
  it('AC-SHL-8.2: when the session\'s tenant becomes suspended, VM actions are disabled without a reload', async () => {
    const r = render();
    const row = await rowOf('web-01');
    expect(within(row).getByRole('button', { name: 'Reboot' }).getAttribute('aria-disabled')).toBeNull();
    r.remote.update({ session: tenantSession(undefined, { tenant: { ...ACME_SUMMARY, status: 'suspended' } }) });
    await waitFor(() =>
      expect(description(within(row).getByRole('button', { name: 'Reboot' }))).toBe("This tenant is suspended. You can view resources but can't change them."),
    );
    await userEvent.click(within(row).getByRole('button', { name: 'Reboot' }));
    expect(r.api.count('/api/vms/vm_01/actions', 'POST')).toBe(0);
    expect(ACME.status).toBe('active'); // the fixture itself is never changed
  });
});
