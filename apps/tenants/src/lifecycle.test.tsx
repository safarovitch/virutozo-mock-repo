// @vitest-environment jsdom
// SPEC-TEN-4: suspend and resume from the row menu and the drawer, against the in-memory API.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Permission, type Task } from '@nimbus/api-client/model';
import { ACME, createFakeApi, makeTenants, task } from './testing/fake-api';
import { stubLayout } from './testing/layout';
import { PROVIDER, renderArea, type Rendered } from './testing/render';

beforeEach(() => stubLayout());
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const RESELLER = PROVIDER.filter((p) => p !== Permission['tenant:suspend']);
const rowOf = (name: string) => within(screen.getByRole('table', { name: 'Tenants' })).getAllByRole('row').find((r) => within(r).queryByText(name, { exact: true })) as HTMLElement;
const toasts = (r: Rendered) => r.remote.fake.published.filter((p) => p.type === 'toast:show').map((p) => p.payload as { kind: string; message: string });
const description = (el: HTMLElement) => (el.getAttribute('aria-describedby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
const frame = () => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

async function menuItem(name: string, item: string) {
  await userEvent.click(within(rowOf(name)).getByRole('button', { name: `Actions for ${name}` }));
  return within(rowOf(name)).getByRole('button', { name: item });
}

async function startSuspend(r: Rendered) {
  await userEvent.click(await menuItem('acme', 'Suspend'));
  const dialog = await screen.findByRole('dialog', { name: 'Suspend acme?' });
  await userEvent.type(within(dialog).getByLabelText('Type acme to confirm.'), 'acme');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Suspend tenant' }));
  await waitFor(() => expect(r.remote.fake.published.some((p) => p.type === 'task:started')).toBe(true));
  return (r.remote.fake.published.find((p) => p.type === 'task:started')?.payload as { task: Task }).task;
}

const listed = async () => {
  const r = renderArea('/');
  await screen.findByText('Showing 100 of 250 tenants');
  return r;
};

describe('suspend and resume', () => {
  it('AC-TEN-4.1: Suspend tenant stays disabled until the typed text exactly matches the name', async () => {
    await listed();
    await userEvent.click(await menuItem('acme', 'Suspend'));
    const dialog = await screen.findByRole('dialog', { name: 'Suspend acme?' });
    const confirm = within(dialog).getByRole('button', { name: 'Suspend tenant' }) as HTMLButtonElement;
    const field = within(dialog).getByLabelText('Type acme to confirm.');
    expect(within(dialog).getByText("Users of Acme Corporation can't start, stop or change VMs, buckets or quotas until the tenant is resumed. Running VMs keep running.")).toBeTruthy();
    for (const typed of ['', 'acm', 'Acme', 'acme ', ' acme']) {
      await userEvent.clear(field);
      if (typed) await userEvent.type(field, typed);
      expect(confirm.disabled).toBe(true);
    }
    await userEvent.clear(field);
    await userEvent.type(field, 'acme');
    expect(confirm.disabled).toBe(false);
  });

  it('AC-TEN-4.5: confirming publishes task:started with the 202 task, and the row shows Suspending… at once', async () => {
    const r = await listed();
    const started = await startSuspend(r);
    expect(started).toMatchObject({ kind: 'tenant.suspend', resource: { id: 't_acme' } });
    expect(r.api.count('/api/tenants/t_acme/suspend', 'POST')).toBe(1);
    await waitFor(() => expect(rowOf('acme').textContent).toContain('Suspending…'));
    expect(screen.queryByRole('dialog', { name: 'Suspend acme?' })).toBeNull();
  });

  it('AC-TEN-4.2: the row shows Suspended when the task succeeds, with a success toast', async () => {
    const r = await listed();
    const started = await startSuspend(r);
    act(() => r.remote.fake.emit('server:task.updated', { task: { ...started, status: 'running', progress: 50, seq: 1 } }));
    expect(rowOf('acme').textContent).toContain('Suspending…');
    act(() => r.remote.fake.emit('server:task.updated', { task: { ...started, status: 'succeeded', progress: 100, seq: 2 } }));
    await waitFor(() => expect(rowOf('acme').textContent).toContain('Suspended'));
    expect(rowOf('acme').textContent).not.toContain('Suspending…');
    act(() => r.remote.fake.emit('server:tenant.updated', { tenant: { id: 't_acme', status: 'suspended' } }));
    await frame();
    expect(rowOf('acme').textContent).toContain('Suspended');
    expect(toasts(r)).toContainEqual(expect.objectContaining({ kind: 'success', message: 'Tenant acme suspended.' }));
  });

  it('AC-TEN-4.3: if the task fails, the row is active again and a toast shows the mapped message', async () => {
    const r = await listed();
    const started = await startSuspend(r);
    const error = { title: 'x', status: 500, code: 'INTERNAL' as const, detail: 'server text' };
    act(() => r.remote.fake.emit('server:task.updated', { task: { ...started, status: 'failed', seq: 2, error } }));
    act(() => r.remote.fake.emit('server:tenant.updated', { tenant: { id: 't_acme', status: 'active' } }));
    await frame();
    await waitFor(() => expect(rowOf('acme').textContent).toContain('Active'));
    expect(rowOf('acme').textContent).not.toContain('Suspending…');
    expect(toasts(r)).toContainEqual(expect.objectContaining({ kind: 'error', message: 'Something went wrong on our side. Try again.' }));
    expect(toasts(r).some((t) => t.message.includes('server text'))).toBe(false);
  });

  it("AC-TEN-4.2: another session's suspend task shows Suspending… too, without a toast here", async () => {
    const r = await listed();
    act(() => r.remote.fake.emit('server:task.updated', { task: task('task_other', { kind: 'tenant.suspend', status: 'running' }) }));
    await waitFor(() => expect(rowOf('acme').textContent).toContain('Suspending…'));
    expect((await menuItem('acme', 'Suspend')).getAttribute('aria-disabled')).toBe('true'); // no second suspend meanwhile
    act(() => r.remote.fake.emit('server:task.updated', { task: task('task_other', { kind: 'tenant.suspend', status: 'succeeded', seq: 2 }) }));
    await waitFor(() => expect(rowOf('acme').textContent).toContain('Suspended'));
    expect(toasts(r)).toEqual([]);
  });

  it("AC-TEN-4.4: without tenant:suspend, Suspend is disabled with \"You don't have permission to suspend tenants.\"", async () => {
    renderArea('/', { permissions: RESELLER });
    await screen.findByText('Showing 100 of 250 tenants');
    const item = await menuItem('acme', 'Suspend');
    expect(item.getAttribute('aria-disabled')).toBe('true');
    expect(description(item)).toBe("You don't have permission to suspend tenants.");
    await userEvent.click(item);
    expect(screen.queryByRole('dialog', { name: 'Suspend acme?' })).toBeNull();
  });

  it('AC-TEN-4.4: for provisioning and error tenants Suspend is disabled with tenants.suspendUnavailable', async () => {
    const tenants = makeTenants(250);
    renderArea('/', { api: createFakeApi({ tenants }) });
    await screen.findByText('Showing 100 of 250 tenants');
    for (const status of ['provisioning', 'error'] as const) {
      const name = tenants.find((t) => t.status === status && rowOf(t.name))?.name as string;
      const item = await menuItem(name, 'Suspend');
      expect(item.getAttribute('aria-disabled')).toBe('true');
      expect(description(item)).toBe('Only active tenants can be suspended.');
      await userEvent.keyboard('{Escape}');
    }
  });

  it('AC-TEN-4.6: a suspended tenant offers Resume; confirming starts the task and the row shows Active when it succeeds', async () => {
    const r = renderArea('/', { api: createFakeApi({ tenants: [{ ...ACME, status: 'suspended' }, ...makeTenants(250).slice(1)] }) });
    await screen.findByText('Showing 100 of 250 tenants');
    await userEvent.click(await menuItem('acme', 'Resume'));
    const dialog = await screen.findByRole('dialog', { name: 'Resume acme?' });
    expect(within(dialog).queryByRole('textbox')).toBeNull(); // plain confirm, no typing (D7-02)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Resume tenant' }));
    await waitFor(() => expect(rowOf('acme').textContent).toContain('Resuming…'));
    const started = (r.remote.fake.published.find((p) => p.type === 'task:started')?.payload as { task: Task }).task;
    expect(started.kind).toBe('tenant.resume');
    act(() => r.remote.fake.emit('server:task.updated', { task: { ...started, status: 'succeeded', progress: 100, seq: 2 } }));
    await waitFor(() => expect(rowOf('acme').textContent).toContain('Active'));
    expect(toasts(r)).toContainEqual(expect.objectContaining({ kind: 'success', message: 'Tenant acme resumed.' }));
  });

  it('AC-TEN-3.11: the drawer of a suspended tenant shows Resume as its action and opens the resume confirm', async () => {
    renderArea('/t_acme', { api: createFakeApi({ tenants: [{ ...ACME, status: 'suspended' }, ...makeTenants(250).slice(1)] }) });
    const drawer = await screen.findByRole('dialog', { name: 'Acme Corporation' });
    await userEvent.click(await within(drawer).findByRole('button', { name: 'Resume' }));
    expect(await screen.findByRole('dialog', { name: 'Resume acme?' })).toBeTruthy();
  });

  it('AC-TEN-4.1: the drawer of an active tenant offers Suspend with the same type-to-confirm dialog', async () => {
    renderArea('/t_acme');
    const drawer = await screen.findByRole('dialog', { name: 'Acme Corporation' });
    await userEvent.click(await within(drawer).findByRole('button', { name: 'Suspend' }));
    expect(within(await screen.findByRole('dialog', { name: 'Suspend acme?' })).getByLabelText('Type acme to confirm.')).toBeTruthy();
  });

  it('MSG-3: a 409 TENANT_NOT_ACTIVE from a stale row shows its message and refetches the tenant', async () => {
    const r = renderArea('/', { api: createFakeApi({ fail: { suspendTenant: { status: 409, code: 'TENANT_NOT_ACTIVE' } } }) });
    await screen.findByText('Showing 100 of 250 tenants');
    await userEvent.click(await menuItem('acme', 'Suspend'));
    const dialog = await screen.findByRole('dialog', { name: 'Suspend acme?' });
    await userEvent.type(within(dialog).getByLabelText('Type acme to confirm.'), 'acme');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Suspend tenant' }));
    await waitFor(() => expect(toasts(r).map((t) => t.kind)).toEqual(['error']));
    await waitFor(() => expect(r.api.count('/api/tenants/t_acme')).toBe(1));
    expect(r.remote.fake.published.some((p) => p.type === 'task:started')).toBe(false);
  });
});
