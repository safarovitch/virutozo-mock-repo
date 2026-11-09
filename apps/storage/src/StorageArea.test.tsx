// @vitest-environment jsdom
// The storage area as the shell mounts it, against the in-memory API (SPEC-STO-1, -2, -3, AC-SHL-8.2).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ACME, ACME_BUCKETS, GIB, createFakeApi, quotasOf } from './testing/fake-api';
import { stubLayout } from './testing/layout';
import { ACME_SUMMARY, TENANT_VIEWER, adminSession, renderArea, resellerSession, tenantSession, type Rendered } from './testing/render';

let current: Rendered | undefined;
const render = (...args: Parameters<typeof renderArea>) => (current = renderArea(...args));
beforeEach(() => stubLayout());
afterEach(() => {
  current?.remote.unmount();
  current = undefined;
  vi.restoreAllMocks();
});

const grid = () => screen.findByRole('table', { name: 'Buckets' });
const rowOf = async (name: string) => (await within(await grid()).findByRole('cell', { name })).closest('tr') as HTMLElement;
const usage = () => screen.findByRole('region', { name: 'Storage usage' });
const toasts = (r: Rendered) => r.remote.fake.published.filter((p) => p.type === 'toast:show').map((p) => p.payload as { kind: string; message: string });
const description = (el: HTMLElement) =>
  (el.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean).map((id) => document.getElementById(id)?.textContent?.trim() ?? '').join(' ');
const at = (ratio: number) => createFakeApi({ tenants: [{ ...ACME, storageQuotaBytes: 100 * GIB, storageUsedBytes: Math.round(ratio * 100 * GIB) }] });

describe('SPEC-STO-1 bucket list and usage', () => {
  it('AC-STO-1.1: usage at 85% has the warning style and the text "85% of quota used"', async () => {
    render('/', { api: at(0.85) });
    const card = await usage();
    await waitFor(() => expect(card.textContent).toContain('85% of quota used'));
    expect(card.textContent).toContain('85 GiB of 100 GiB');
    expect(card.querySelector('.nui-usage--warning')).not.toBeNull();
    expect(card.textContent).toContain('Approaching quota'); // not colour alone (NFR-A11Y-3)
  });

  it('AC-STO-1.1: thresholds use the exact ratio; the percent is floored; over 100% shows the real figure in danger', async () => {
    render('/', { api: at(0.8499) });
    await waitFor(async () => expect((await usage()).textContent).toContain('84% of quota used'));
    expect((await usage()).querySelector('.nui-usage--warning')).not.toBeNull();
    current?.remote.unmount();
    render('/', { api: at(1.1) });
    await waitFor(async () => expect((await usage()).textContent).toContain('110% of quota used'));
    expect((await usage()).querySelector('.nui-usage--danger')).not.toBeNull();
  });

  it('AC-STO-1.2: sizes use formatBytes: binary units, one decimal, no trailing .0', async () => {
    render();
    expect((await rowOf('acme-backups')).textContent).toContain('80 GiB');
    expect((await rowOf('acme-media')).textContent).toContain('1.5 GiB');
    expect((await rowOf('acme-scratch')).textContent).toContain('0 B');
    expect((await rowOf('acme-assets')).textContent).toContain('On');
    expect((await rowOf('acme-logs-2026')).textContent).toContain('88,000');
  });

  it('AC-STO-1.3: the empty state offers Create bucket only with bucket:create', async () => {
    render('/', { api: createFakeApi({ buckets: [] }) });
    const empty = await screen.findByRole('region', { name: 'No buckets yet.' });
    expect(within(empty).getByRole('button', { name: 'Create bucket' })).toBeTruthy();
    current?.remote.unmount();
    render('/', { session: tenantSession(TENANT_VIEWER), api: createFakeApi({ buckets: [] }) });
    const viewerEmpty = await screen.findByRole('region', { name: 'No buckets yet.' });
    expect(within(viewerEmpty).queryByRole('button')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create bucket' })).toBeNull();
  });

  it('AC-STO-1.4: bucket.updated and quota.updated update the list and the usage card, with no request', async () => {
    const r = render();
    await rowOf('acme-assets');
    await waitFor(async () => expect((await usage()).textContent).toContain('82% of quota used'));
    const before = r.api.requests.length;
    act(() => {
      r.remote.fake.emit('server:bucket.updated', { tenantId: 't_acme', name: 'acme-new', bucket: { ...ACME_BUCKETS[0]!, name: 'acme-new', sizeBytes: 0, objectCount: 0 } });
      r.remote.fake.emit('server:bucket.updated', { tenantId: 't_acme', name: 'acme-scratch', bucket: null });
      r.remote.fake.emit('server:quota.updated', { tenantId: 't_acme', quotas: { ...quotasOf(ACME), storageUsedBytes: 240 * GIB } });
      r.remote.fake.emit('server:bucket.updated', { tenantId: 't_other', name: 'other-x', bucket: { ...ACME_BUCKETS[0]!, name: 'other-x', tenantId: 't_other' } });
    });
    const names = () => within(screen.getByRole('table', { name: 'Buckets' })).getAllByRole('row').slice(1).map((row) => row.querySelector('td')?.textContent);
    await waitFor(() => expect(names()).toEqual(['acme-assets', 'acme-backups', 'acme-logs-2026', 'acme-media', 'acme-new']));
    expect((await usage()).textContent).toContain('96% of quota used');
    expect(r.api.requests.length).toBe(before);
  });

  it('MSG-3: a failed list shows the mapped message and Retry loads again', async () => {
    const api = createFakeApi({ fail: { listBuckets: { status: 500, code: 'INTERNAL' } } });
    render('/', { api });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Something went wrong on our side. Try again.');
    const before = api.count('/api/buckets');
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(api.count('/api/buckets')).toBe(before + 1));
  });

  it('RBAC-5: without bucket:read the area renders no data and makes no request', async () => {
    const r = render('/', { session: tenantSession([]) });
    expect(await screen.findByRole('heading', { name: '403 – No access' })).toBeTruthy();
    expect(r.api.requests).toHaveLength(0);
  });
});

describe('SPEC-STO-2 create and delete', () => {
  const openCreate = async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Create bucket' }));
    return screen.findByRole('dialog', { name: 'Create bucket' });
  };
  const nameField = (dialog: HTMLElement) => within(dialog).getByRole('textbox', { name: 'Name' });

  it('AC-STO-2.1: "My_Bucket" shows storage.bucketNameInvalid before submit, and nothing is sent', async () => {
    const r = render();
    const dialog = await openCreate();
    await userEvent.type(nameField(dialog), 'My_Bucket');
    await userEvent.tab(); // blur
    expect(within(dialog).getByText('Use 3–63 lowercase letters, numbers, dots and hyphens.')).toBeTruthy();
    expect(nameField(dialog).getAttribute('aria-invalid')).toBe('true');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create bucket' }));
    expect(r.api.count('/api/buckets', 'POST')).toBe(0);
  });

  it('AC-STO-2.2: "192.168.1.1" is rejected with storage.bucketNameIp', async () => {
    const r = render();
    const dialog = await openCreate();
    await userEvent.type(nameField(dialog), '192.168.1.1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create bucket' }));
    expect(within(dialog).getByText("Bucket names can't look like IP addresses.")).toBeTruthy();
    expect(r.api.count('/api/buckets', 'POST')).toBe(0);
  });

  it('AC-STO-2.3: with the quota fully used, errors.QUOTA_EXCEEDED shows in the dialog and the values are kept', async () => {
    render('/', { api: at(1) });
    const dialog = await openCreate();
    await userEvent.type(nameField(dialog), 'acme-more');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create bucket' }));
    expect((await within(dialog).findByRole('alert')).textContent).toBe('Storage quota is full. Free up space or ask an admin to raise the quota.');
    expect((nameField(dialog) as HTMLInputElement).value).toBe('acme-more');
  });

  it('MSG-3: a taken name shows errors.BUCKET_NAME_TAKEN at the field', async () => {
    render();
    const dialog = await openCreate();
    await userEvent.type(nameField(dialog), 'acme-assets');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create bucket' }));
    expect(await within(dialog).findByText('A bucket with this name already exists.')).toBeTruthy();
    expect(nameField(dialog).getAttribute('aria-invalid')).toBe('true');
  });

  it('AC-STO-2.6: creating a bucket with Versioning on lists it with Versioning "On" and shows the toast', async () => {
    const r = render();
    const dialog = await openCreate();
    await userEvent.type(nameField(dialog), 'acme-versioned');
    await userEvent.click(within(dialog).getByRole('switch', { name: 'Versioning' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create bucket' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Create bucket' })).toBeNull());
    expect(r.api.requests.find((q) => q.method === 'POST')?.body).toEqual({ name: 'acme-versioned', versioning: true });
    expect((await rowOf('acme-versioned')).textContent).toContain('On');
    expect(toasts(r)).toContainEqual({ kind: 'success', message: 'Bucket acme-versioned created.' });
  });

  it('AC-STO-2.4: deleting a non-empty bucket shows errors.BUCKET_NOT_EMPTY and the dialog stays open', async () => {
    render();
    await userEvent.click(within(await rowOf('acme-backups')).getByRole('button', { name: 'Delete acme-backups' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete acme-backups?' });
    const confirm = within(dialog).getByRole('button', { name: 'Delete bucket' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true); // type-to-confirm
    await userEvent.type(within(dialog).getByRole('textbox'), 'acme-backups');
    await userEvent.click(confirm);
    expect((await within(dialog).findByRole('alert')).textContent).toBe('Empty the bucket before deleting it.');
    expect(screen.getByRole('dialog', { name: 'Delete acme-backups?' })).toBeTruthy();
    expect(await rowOf('acme-backups')).toBeTruthy();
  });

  it('AC-STO-2.5: deleting an empty bucket after typing its exact name removes it and shows storage.toast.deleted', async () => {
    const r = render();
    await userEvent.click(within(await rowOf('acme-scratch')).getByRole('button', { name: 'Delete acme-scratch' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete acme-scratch?' });
    await userEvent.type(within(dialog).getByRole('textbox'), 'Acme-scratch');
    expect((within(dialog).getByRole('button', { name: 'Delete bucket' }) as HTMLButtonElement).disabled).toBe(true); // case-sensitive
    await userEvent.clear(within(dialog).getByRole('textbox'));
    await userEvent.type(within(dialog).getByRole('textbox'), 'acme-scratch');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete bucket' }));
    await waitFor(() => expect(within(screen.getByRole('table', { name: 'Buckets' })).queryByRole('cell', { name: 'acme-scratch' })).toBeNull());
    expect(toasts(r)).toContainEqual({ kind: 'success', message: 'Bucket acme-scratch deleted.' });
    expect(r.api.count('/api/buckets/acme-scratch', 'DELETE')).toBe(1);
  });

  it('AC-SHL-8.2: when the own tenant is suspended, Create bucket and every Delete are disabled with the tooltip', async () => {
    const r = render();
    await rowOf('acme-assets');
    act(() => r.remote.update({ session: tenantSession(undefined, { tenant: { ...ACME_SUMMARY, status: 'suspended' } }) }));
    const create = screen.getByRole('button', { name: 'Create bucket' });
    await waitFor(() => expect(description(create)).toBe('Changes are disabled while this tenant is suspended.'));
    expect(description(within(await rowOf('acme-scratch')).getByRole('button', { name: 'Delete acme-scratch' }))).toBe('Changes are disabled while this tenant is suspended.');
    await userEvent.click(create);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('RBAC-4: a tenant_viewer gets a read-only table', async () => {
    render('/', { session: tenantSession(TENANT_VIEWER) });
    const row = await rowOf('acme-scratch');
    expect(within(row).queryByRole('button')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create bucket' })).toBeNull();
  });
});

describe('SPEC-STO-3 storage for admins', () => {
  const BETA = { ...ACME, id: 't_beta', name: 'beta', displayName: 'Beta Ltd', status: 'suspended' as const };
  const twoTenants = (acme = ACME) => createFakeApi({ tenants: [acme, BETA], buckets: [...ACME_BUCKETS, { ...ACME_BUCKETS[0]!, name: 'beta-assets', tenantId: 't_beta' }] });
  const picker = () => screen.findByRole('combobox', { name: 'Tenant' });

  it('AC-STO-3.1: a provider_admin picking a tenant sees its buckets and usage card, without create/delete', async () => {
    const r = render('/', { session: adminSession(), api: twoTenants() });
    expect(await screen.findByRole('heading', { name: 'Choose a tenant to see its buckets.' })).toBeTruthy();
    expect(r.api.count('/api/buckets')).toBe(0);
    await userEvent.type(await picker(), 'acme');
    await userEvent.click(await screen.findByRole('option', { name: /Acme Corporation/ }));
    expect(r.history.at(-1)).toEqual({ to: '/storage?tenantId=t_acme', replace: false });
    const row = await rowOf('acme-backups');
    expect(within(row).queryByRole('button')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create bucket' })).toBeNull();
    await waitFor(async () => expect((await usage()).textContent).toContain('82% of quota used'));
    expect(r.api.requests.find((q) => q.url.pathname === '/api/buckets')?.url.searchParams.get('tenantId')).toBe('t_acme');
    await waitFor(async () => expect(((await picker()) as HTMLInputElement).value).toBe('Acme Corporation'));
  });

  it('AC-STO-3.2: a reseller_admin picking one of their tenants sees its buckets and usage card, read-only', async () => {
    render('/?tenantId=t_acme', { session: resellerSession() });
    const row = await rowOf('acme-scratch');
    expect(within(row).queryByRole('button')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create bucket' })).toBeNull();
    await waitFor(async () => expect((await usage()).textContent).toContain('82% of quota used'));
  });

  it('AC-STO-3.3: a foreign tenantId shows errors.NOT_FOUND without Retry; the picker stays usable', async () => {
    const r = render('/?tenantId=t_foreign', { session: resellerSession() });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('This item no longer exists.');
    expect(within(alert).queryByRole('button')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Storage usage' })).toBeNull();
    expect(((await picker()) as HTMLInputElement).value).toBe('');
    expect(r.history).toEqual([]);
  });

  it('AC-STO-3.1: a suspended picked tenant shows the admin banner, and tenant.updated removes it without a reload', async () => {
    const r = render('/?tenantId=t_beta', { session: adminSession(), api: twoTenants() });
    const banner = await screen.findByText('Beta Ltd is suspended. Resume it to make changes.');
    expect(banner.closest('[role="status"]')).toBeTruthy();
    await userEvent.click(screen.getByRole('link', { name: 'Open tenant' }));
    expect(r.history.at(-1)).toEqual({ to: '/tenants/t_beta', replace: false });
    act(() => r.remote.fake.emit('server:tenant.updated', { tenant: { id: 't_beta', status: 'active' } }));
    await waitFor(() => expect(screen.queryByText(/is suspended/)).toBeNull());
  });
});
