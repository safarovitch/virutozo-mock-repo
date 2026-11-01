// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Permission } from '@nimbus/api-client/model';
import { createFakeApi, makeTenants } from './testing/fake-api';
import { stubLayout } from './testing/layout';
import { READ_ONLY, renderArea } from './testing/render';

beforeEach(() => stubLayout());
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const grid = () => screen.getByRole('table', { name: 'Tenants' });
const bodyRows = () => within(grid()).getAllByRole('row').slice(1);

describe('tenant list', () => {
  it('AC-TEN-1.2: typing "acme" sends exactly one request 300 ms after the last keystroke and puts ?q=acme in the URL', async () => {
    const { api, history } = renderArea('/');
    await screen.findByText('Showing 100 of 250 tenants');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const before = api.count('/api/tenants');
    const search = screen.getByRole('searchbox', { name: 'Search tenants' });
    for (const value of ['a', 'ac', 'acm', 'acme']) {
      fireEvent.change(search, { target: { value } });
      await act(async () => vi.advanceTimersByTimeAsync(100));
    }
    await act(async () => vi.advanceTimersByTimeAsync(199)); // 299 ms after the last keystroke
    expect(api.count('/api/tenants')).toBe(before);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    await act(async () => vi.advanceTimersByTimeAsync(50)); // let the request and React Query's notifications run
    expect(api.count('/api/tenants')).toBe(before + 1);
    vi.useRealTimers();
    expect(api.requests.at(-1)?.url.searchParams.get('q')).toBe('acme');
    expect(history.at(-1)).toEqual({ to: '/tenants?q=acme', replace: false });
    await screen.findByText('Showing 1 of 1 tenants');
  });

  it('AC-TEN-1.2: a second search while typing replaces the history entry instead of pushing (D5-04)', async () => {
    const { history } = renderArea('/');
    await screen.findByText('Showing 100 of 250 tenants');
    const search = screen.getByRole('searchbox', { name: 'Search tenants' });
    fireEvent.change(search, { target: { value: 'tenant-0001' } });
    await waitFor(() => expect(history.at(-1)?.to).toBe('/tenants?q=tenant-0001'));
    fireEvent.change(search, { target: { value: 'tenant-00012' } });
    await waitFor(() => expect(history.at(-1)).toEqual({ to: '/tenants?q=tenant-00012', replace: true }));
    expect(history.filter((h) => !h.replace)).toHaveLength(1);
  });

  it('AC-TEN-1.3: clicking Name toggles asc → desc with aria-sort, and the request uses sort=name / sort=-name', async () => {
    const { api } = renderArea('/');
    await screen.findByText('Showing 100 of 250 tenants');
    const header = screen.getByRole('columnheader', { name: /Name/ });
    expect(header.getAttribute('aria-sort')).toBe('ascending');
    expect(api.requests.at(-1)?.url.searchParams.get('sort')).toBe('name');
    fireEvent.click(within(header).getByRole('button'));
    await waitFor(() => expect(header.getAttribute('aria-sort')).toBe('descending'));
    await waitFor(() => expect(api.requests.at(-1)?.url.searchParams.get('sort')).toBe('-name'));
    fireEvent.click(within(header).getByRole('button'));
    await waitFor(() => expect(header.getAttribute('aria-sort')).toBe('ascending'));
    expect(api.requests.filter((r) => r.url.pathname === '/api/tenants').at(-1)?.url.searchParams.get('sort')).toBe('name');
  });

  it('AC-TEN-1.3: Created and Storage start descending, newest and largest first (D5-01)', async () => {
    const { history } = renderArea('/');
    await screen.findByText('Showing 100 of 250 tenants');
    fireEvent.click(within(screen.getByRole('columnheader', { name: /Created/ })).getByRole('button'));
    await waitFor(() => expect(history.at(-1)?.to).toBe('/tenants?sort=-createdAt'));
    fireEvent.click(within(screen.getByRole('columnheader', { name: /Storage/ })).getByRole('button'));
    await waitFor(() => expect(history.at(-1)?.to).toBe('/tenants?sort=-storageUsedBytes'));
  });

  it('AC-TEN-1.4: /tenants?status=suspended&sort=-createdAt shows the filter and sort from the URL', async () => {
    const { api } = renderArea('/?status=suspended&sort=-createdAt');
    await screen.findByText(/^Showing \d+ of \d+ tenants$/);
    expect((screen.getByRole('combobox', { name: 'Status' }) as HTMLSelectElement).value).toBe('suspended');
    expect(screen.getByRole('columnheader', { name: /Created/ }).getAttribute('aria-sort')).toBe('descending');
    const params = api.requests.find((r) => r.url.pathname === '/api/tenants')?.url.searchParams;
    expect(params?.get('status')).toBe('suspended');
    expect(params?.get('sort')).toBe('-createdAt');
  });

  it('AC-TEN-1.4: an invalid status in the URL is removed with a replace (D5-06)', async () => {
    const { history } = renderArea('/?status=bogus');
    await waitFor(() => expect(history[0]).toEqual({ to: '/tenants', replace: true }));
  });

  it('AC-TEN-1.6: a tenant.updated event changes that row\'s badge without refetching the list', async () => {
    const { api, remote } = renderArea('/');
    await screen.findByText('Showing 100 of 250 tenants');
    const acmeRow = () => bodyRows().find((r) => within(r).queryByText('acme')) as HTMLElement;
    expect(within(acmeRow()).getByText('Active')).toBeTruthy();
    const before = api.count('/api/tenants');
    act(() => remote.fake.emit('server:tenant.updated', { tenant: { id: 't_acme', status: 'suspended' } }));
    await waitFor(() => expect(within(acmeRow()).getByText('Suspended')).toBeTruthy());
    expect(api.count('/api/tenants')).toBe(before);
  });

  it('AC-TEN-1.6: the row stays in a status-filtered list after its status changes (D5-02)', async () => {
    const { remote } = renderArea('/?status=active');
    await screen.findByText(/^Showing \d+ of \d+ tenants$/);
    act(() => remote.fake.emit('server:tenant.updated', { tenant: { id: 't_acme', status: 'suspended' } }));
    await waitFor(() => expect(within(bodyRows().find((r) => within(r).queryByText('acme')) as HTMLElement).getByText('Suspended')).toBeTruthy());
  });

  it('AC-TEN-1.7: Enter on a focused row opens that tenant\'s drawer (push)', async () => {
    const { history } = renderArea('/');
    await screen.findByText('Showing 100 of 250 tenants');
    const first = bodyRows()[0] as HTMLElement;
    first.focus();
    fireEvent.keyDown(first, { key: 'Enter' });
    expect(history.at(-1)).toEqual({ to: '/tenants/t_acme', replace: false });
  });

  it('AC-TEN-1.1: the list is requested in pages of limit=100', async () => {
    const { api } = renderArea('/', { api: createFakeApi({ tenants: makeTenants(250) }) });
    await screen.findByText('Showing 100 of 250 tenants');
    expect(api.requests.find((r) => r.url.pathname === '/api/tenants')?.url.searchParams.get('limit')).toBe('100');
  });

  it('MSG-1: with no tenants the list shows tenants.empty, and without filters there is no Clear filters', async () => {
    renderArea('/', { api: createFakeApi({ tenants: [] }) });
    expect(await screen.findByRole('heading', { name: 'No tenants yet' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  });

  it('AC-TEN-1.4: no matches shows tenants.noMatches, and Clear filters pushes a URL that keeps only the sort', async () => {
    const { history } = renderArea('/?q=zzz&sort=-name');
    expect(await screen.findByRole('heading', { name: 'No tenants match your filters' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(history.at(-1)).toEqual({ to: '/tenants?sort=-name', replace: false });
  });

  it('MSG-3: a failed load shows the mapped message and Retry loads again', async () => {
    const api = createFakeApi({ fail: { listTenants: { status: 500, code: 'INTERNAL' } } });
    renderArea('/', { api });
    expect(await screen.findByText('Something went wrong on our side. Try again.')).toBeTruthy();
    const before = api.count('/api/tenants');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(api.count('/api/tenants')).toBe(before + 1));
  });

  it('RBAC-5: without tenant:read the area shows no access and requests nothing', async () => {
    const { api } = renderArea('/', { permissions: READ_ONLY.filter((p) => p !== Permission['tenant:read']) });
    expect(await screen.findByRole('heading', { name: '403 – No access' })).toBeTruthy();
    expect(api.requests).toHaveLength(0);
  });

  it('RT-7: tenants removes its bus subscriptions on unmount', async () => {
    const { remote } = renderArea('/');
    await screen.findByText('Showing 100 of 250 tenants');
    expect(remote.fake.subscriberCount()).toBeGreaterThan(0);
    expect(remote.unmount()).toBe(0);
  });

  it('RT-6: realtime:reconnected refetches the list', async () => {
    const { api, remote } = renderArea('/');
    await screen.findByText('Showing 100 of 250 tenants');
    const before = api.count('/api/tenants');
    act(() => remote.fake.emit('realtime:reconnected', { downtimeMs: 2000 }));
    await waitFor(() => expect(api.count('/api/tenants')).toBeGreaterThan(before));
  });
});
