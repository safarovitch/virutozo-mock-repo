// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { ACME, createFakeApi, makeTenants, task } from './testing/fake-api';
import { stubLayout } from './testing/layout';
import { READ_ONLY, renderArea } from './testing/render';

beforeEach(() => stubLayout());
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const drawer = () => screen.getByRole('dialog');
/** Waits until the drawer is open (it opens in an effect). */
const opened = () => screen.findByRole('dialog');
const acmeRow = () => within(screen.getByRole('table', { name: 'Tenants' })).getAllByRole('row').find((r) => within(r).queryByText('acme')) as HTMLElement;
const storageField = () => within(drawer()).getByRole('spinbutton', { name: 'Storage quota (GiB)' }) as HTMLInputElement;

describe('tenant drawer', () => {
  it('AC-TEN-3.1: opening /tenants/t_acme directly shows the list with the drawer open for that tenant', async () => {
    renderArea('/t_acme');
    await screen.findByText('Showing 100 of 250 tenants');
    expect(await within(await opened()).findByRole('heading', { name: 'Acme Corporation' })).toBeTruthy();
    expect(within(drawer()).getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe('true');
    expect(within(drawer()).getByText('tom@acme.test')).toBeTruthy();
  });

  it('AC-TEN-3.2: lowering storage below usage blocks the save with the formatted usage', async () => {
    const { api } = renderArea('/t_acme?tab=quotas');
    await opened();
    await waitFor(() => expect(storageField().value).toBe('250'));
    fireEvent.change(storageField(), { target: { value: '200' } });
    fireEvent.click(within(drawer()).getByRole('button', { name: 'Save quotas' }));
    expect(await within(await opened()).findByText("Storage quota can't be lower than current usage (205 GiB).")).toBeTruthy();
    expect(storageField().getAttribute('aria-invalid')).toBe('true');
    expect(api.count('/api/tenants/t_acme/quotas', 'PUT')).toBe(0);
  });

  it('AC-TEN-3.2: a server QUOTA_BELOW_USAGE lands on the storage field with the same message', async () => {
    const api = createFakeApi({ fail: { updateQuotas: { status: 422, code: 'QUOTA_BELOW_USAGE', params: { resource: 'storage', used: ACME.storageUsedBytes } } } });
    renderArea('/t_acme?tab=quotas', { api });
    await opened();
    await waitFor(() => expect(storageField().value).toBe('250'));
    fireEvent.change(storageField(), { target: { value: '300' } });
    fireEvent.click(within(drawer()).getByRole('button', { name: 'Save quotas' }));
    expect(await within(await opened()).findByText("Storage quota can't be lower than current usage (205 GiB).")).toBeTruthy();
  });

  it('AC-TEN-3.3: a successful quota update updates the list row\'s storage bar', async () => {
    const { api, remote } = renderArea('/t_acme?tab=quotas');
    await opened();
    await waitFor(() => expect(storageField().value).toBe('250'));
    expect(within(acmeRow()).getByText('205 GiB of 250 GiB')).toBeTruthy();
    fireEvent.change(storageField(), { target: { value: '300' } });
    fireEvent.click(within(drawer()).getByRole('button', { name: 'Save quotas' }));
    await waitFor(() => expect(within(acmeRow()).getByText('205 GiB of 300 GiB')).toBeTruthy());
    expect(api.requests.find((r) => r.method === 'PUT')?.body).toEqual({ storageQuotaBytes: 300 * 1024 ** 3, vmQuota: 50 });
    await waitFor(() => expect(remote.fake.published).toContainEqual(expect.objectContaining({ type: 'toast:show', payload: { kind: 'success', message: 'Quotas updated.' } })));
  });

  it('AC-TEN-3.3: the optimistic row update rolls back when the save fails', async () => {
    let release = () => undefined as void;
    const api = createFakeApi({ fail: { updateQuotas: { status: 500, code: 'INTERNAL' } } });
    const slow: typeof fetch = async (input, init) => {
      if (init?.method === 'PUT') await new Promise<void>((r) => (release = r));
      return api.fetch(input, init);
    };
    renderArea('/t_acme?tab=quotas', { api: { ...api, fetch: slow } });
    await opened();
    await waitFor(() => expect(storageField().value).toBe('250'));
    fireEvent.change(storageField(), { target: { value: '300' } });
    fireEvent.click(within(drawer()).getByRole('button', { name: 'Save quotas' }));
    await waitFor(() => expect(within(acmeRow()).getByText('205 GiB of 300 GiB')).toBeTruthy()); // optimistic
    act(() => release());
    await waitFor(() => expect(within(acmeRow()).getByText('205 GiB of 250 GiB')).toBeTruthy()); // rolled back
    expect(await within(await opened()).findByRole('alert')).toBeTruthy();
  });

  it('AC-SHL-3.2: a 403 on the quota save shows the errors.FORBIDDEN toast and changes nothing', async () => {
    const api = createFakeApi({ fail: { updateQuotas: { status: 403, code: 'FORBIDDEN' } } });
    const { remote } = renderArea('/t_acme?tab=quotas', { api });
    await opened();
    await waitFor(() => expect(storageField().value).toBe('250'));
    fireEvent.change(storageField(), { target: { value: '300' } });
    fireEvent.click(within(drawer()).getByRole('button', { name: 'Save quotas' }));
    await waitFor(() => expect(remote.fake.published).toContainEqual(expect.objectContaining({ type: 'toast:show', payload: { kind: 'error', message: "You don't have permission to do this." } })));
    await waitFor(() => expect(within(acmeRow()).getByText('205 GiB of 250 GiB')).toBeTruthy());
    expect(within(drawer()).queryByRole('alert')).toBeNull(); // the toast is the only message
  });

  it('AC-TEN-3.4: without quota:update the quotas are read-only text, not disabled inputs', async () => {
    renderArea('/t_acme?tab=quotas', { permissions: READ_ONLY });
    expect(await within(await opened()).findByText('250 GiB')).toBeTruthy();
    expect(within(drawer()).queryByRole('spinbutton')).toBeNull();
    expect(within(drawer()).queryByRole('button', { name: 'Save quotas' })).toBeNull();
  });

  it('AC-TEN-3.6: the Activity list shows a new suspend task and its progress live', async () => {
    const { remote } = renderArea('/t_acme?tab=activity');
    expect(await within(await opened()).findByText('No activity in the last 24 hours.')).toBeTruthy();
    act(() => remote.fake.emit('server:task.updated', { task: task('task_s1', { progress: 40, seq: 1 }) }));
    const bar = await within(await opened()).findByRole('progressbar', { name: 'Suspend tenant: acme' });
    expect(bar.getAttribute('aria-valuenow')).toBe('40');
    act(() => remote.fake.emit('server:task.updated', { task: task('task_s1', { progress: 80, seq: 2 }) }));
    await waitFor(() => expect(bar.getAttribute('aria-valuenow')).toBe('80'));
    act(() => remote.fake.emit('server:task.updated', { task: task('task_s1', { status: 'succeeded', progress: 100, seq: 3, finishedAt: '2026-11-01T11:51:00.000Z' }) }));
    await waitFor(() => expect(within(drawer()).getByText('Succeeded')).toBeTruthy());
    expect(within(drawer()).queryByRole('progressbar')).toBeNull();
  });

  it('AC-TEN-3.7: /tenants/<non-existent id> shows the not-found state', async () => {
    renderArea('/t_nope1');
    expect(await within(await opened()).findByRole('heading', { name: 'This item no longer exists.' })).toBeTruthy();
  });

  it('AC-TEN-3.11: for a suspended tenant the quotas are read-only, even with quota:update', async () => {
    const tenants = makeTenants(20).map((t) => (t.id === 't_acme' ? { ...t, status: 'suspended' as const } : t));
    renderArea('/t_acme?tab=quotas', { api: createFakeApi({ tenants }) });
    expect(await within(await opened()).findByText('Changes are disabled while this tenant is suspended.')).toBeTruthy();
    expect(within(drawer()).queryByRole('spinbutton')).toBeNull();
  });

  it('AC-TEN-3.12: switching tabs replaces the URL; closing pushes the list URL without tab', async () => {
    const { history } = renderArea('/t_acme?status=active');
    const quotas = await within(await opened()).findByRole('tab', { name: 'Quotas' });
    fireEvent.click(quotas);
    expect(history.at(-1)).toEqual({ to: '/tenants/t_acme?status=active&tab=quotas', replace: true });
    fireEvent.keyDown(within(drawer()).getByRole('tab', { name: 'Quotas' }), { key: 'ArrowRight' });
    expect(history.at(-1)).toEqual({ to: '/tenants/t_acme?status=active&tab=activity', replace: true });
    fireEvent.click(within(drawer()).getByRole('button', { name: 'Close' }));
    expect(history.at(-1)).toEqual({ to: '/tenants?status=active', replace: false });
  });

  it('AC-TEN-3.13: /tenants/t_acme?tab=bogus shows Overview and the URL becomes /tenants/t_acme', async () => {
    const { history } = renderArea('/t_acme?tab=bogus');
    await waitFor(() => expect(history[0]).toEqual({ to: '/tenants/t_acme', replace: true }));
    expect((await within(await opened()).findByRole('tab', { name: 'Overview' })).getAttribute('aria-selected')).toBe('true');
  });

  it('RT-4: a quota.updated event patches the drawer and the list row without a refetch', async () => {
    const { api, remote } = renderArea('/t_acme?tab=quotas', { permissions: READ_ONLY });
    expect(await within(await opened()).findByText('250 GiB')).toBeTruthy();
    const before = api.requests.length;
    const GIB = 1024 ** 3;
    act(() =>
      remote.fake.emit('server:quota.updated', {
        tenantId: 't_acme',
        quotas: { storageQuotaBytes: 400 * GIB, storageUsedBytes: 210 * GIB, vmQuota: 50, vmCount: 40, planMaxStorageQuotaBytes: 1024 * GIB, planMaxVmQuota: 50 },
      }),
    );
    expect(await within(await opened()).findByText('400 GiB')).toBeTruthy();
    expect(within(acmeRow()).getByText('210 GiB of 400 GiB')).toBeTruthy();
    expect(api.requests.length).toBe(before);
  });
});
