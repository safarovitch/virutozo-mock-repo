// @vitest-environment jsdom
// SPEC-TEN-2: the create tenant wizard inside the area, against the in-memory API.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createFakeApi } from './testing/fake-api';
import { stubLayout } from './testing/layout';
import { READ_ONLY, renderArea, type Rendered } from './testing/render';

beforeEach(() => stubLayout());
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const wizard = () => screen.getByRole('dialog', { name: 'Create tenant' });
const heading = (name: string) => within(wizard()).getByRole('heading', { level: 2, name });
const input = (name: string) => within(wizard()).getByLabelText(name) as HTMLInputElement;
const click = (name: string) => userEvent.click(within(wizard()).getByRole('button', { name }));

async function openWizard(r?: Partial<Parameters<typeof renderArea>[1]>): Promise<Rendered> {
  const rendered = renderArea('/', r);
  await screen.findByText('Showing 100 of 250 tenants');
  await userEvent.click(screen.getByRole('button', { name: 'Create tenant' }));
  await screen.findByRole('dialog', { name: 'Create tenant' });
  return rendered;
}

async function fillDetails(name = 'new-co', email = 'admin@new-co.test') {
  await userEvent.type(input('Name'), name);
  await userEvent.type(input('Admin email'), email);
  await click('Next');
}

async function pickPlan(plan: string) {
  await userEvent.click(await within(wizard()).findByRole('radio', { name: new RegExp(`^${plan}`) }));
}

async function setValue(label: string, value: string) {
  await userEvent.clear(input(label));
  if (value) await userEvent.type(input(label), value);
}

describe('create tenant wizard', () => {
  it('AC-TEN-2.1: an invalid name keeps step 1 open with tenants.nameInvalid', async () => {
    await openWizard();
    await fillDetails('Acme Corp');
    expect(heading('Details')).toBeTruthy();
    expect(within(wizard()).getByText('Use lowercase letters, numbers and hyphens.')).toBeTruthy();
    expect(input('Name').getAttribute('aria-invalid')).toBe('true');
  });

  it('AC-TEN-2.2: on Starter, 200 GiB blocks Next with "Starter allows up to 100 GiB."', async () => {
    await openWizard();
    await fillDetails();
    await pickPlan('Starter');
    await setValue('Storage quota (GiB)', '200');
    await click('Next');
    expect(heading('Plan & quotas')).toBeTruthy();
    expect(within(wizard()).getByText('Starter allows up to 100 GiB.')).toBeTruthy();
  });

  it('AC-TEN-2.8: on Starter, 20 VMs blocks Next with "Starter allows up to 10 VMs."', async () => {
    await openWizard();
    await fillDetails();
    await pickPlan('Starter');
    await setValue('VM quota', '20');
    await click('Next');
    expect(heading('Plan & quotas')).toBeTruthy();
    expect(within(wizard()).getByText('Starter allows up to 10 VMs.')).toBeTruthy();
  });

  it("AC-TEN-2.2: picking a plan fills its defaults; quotas the user edited keep their value when the plan changes", async () => {
    await openWizard();
    await fillDetails();
    await pickPlan('Starter');
    expect(input('Storage quota (GiB)').value).toBe('50');
    expect(input('VM quota').value).toBe('5');
    await setValue('VM quota', '8');
    await pickPlan('Business');
    expect(input('Storage quota (GiB)').value).toBe('250'); // untouched: follows the plan
    expect(input('VM quota').value).toBe('8'); // edited: kept
  });

  it('AC-TEN-2.2: if plans fail to load, step 2 shows the error with Retry and Next stays blocked', async () => {
    await openWizard({ api: createFakeApi({ fail: { listPlans: { status: 500, code: 'INTERNAL' } } }) });
    await fillDetails();
    expect(within(wizard()).getByText('Something went wrong on our side. Try again.')).toBeTruthy();
    expect(within(wizard()).getByRole('button', { name: 'Retry' })).toBeTruthy();
    await click('Next');
    expect(heading('Plan & quotas')).toBeTruthy();
  });

  it('AC-TEN-2.3: Review shows every value and each Edit link returns to its step with values kept', async () => {
    await openWizard();
    await userEvent.type(input('Display name'), 'New Co');
    await fillDetails();
    await pickPlan('Starter');
    await click('Next');
    expect(heading('Review')).toBeTruthy();
    const review = within(wizard());
    for (const text of ['new-co', 'New Co', 'admin@new-co.test', 'Starter', '50 GiB', '5']) expect(review.getByText(text)).toBeTruthy();

    await click('Edit Details');
    expect(heading('Details')).toBeTruthy();
    expect(input('Name').value).toBe('new-co');
    expect(input('Display name').value).toBe('New Co');
    await click('Next');
    await click('Next');
    await click('Edit Plan & quotas');
    expect(heading('Plan & quotas')).toBeTruthy();
    expect((within(wizard()).getByRole('radio', { name: /^Starter/ }) as HTMLInputElement).checked).toBe(true);
    expect(input('Storage quota (GiB)').value).toBe('50');
  });

  it('AC-TEN-2.4: a 409 returns to step 1 with "This name is already taken." on Name', async () => {
    await openWizard();
    await fillDetails('acme'); // the fake API, like the server, knows acme
    await pickPlan('Starter');
    await click('Next');
    await click('Create tenant');
    await waitFor(() => expect(heading('Details')).toBeTruthy());
    expect(within(wizard()).getByText('This name is already taken.')).toBeTruthy();
    expect(input('Name').value).toBe('acme');
    expect(document.activeElement).toBe(heading('Details')); // AC-TEN-2.6: the jump moves focus too
  });

  it('MSG-3: a 422 VALIDATION_FAILED lands on the fields it names and opens the earliest step with one', async () => {
    const api = createFakeApi({ fail: { createTenant: { status: 422, code: 'VALIDATION_FAILED', errors: [{ field: 'vmQuota', message: 'server text' }] } } });
    await openWizard({ api });
    await fillDetails();
    await pickPlan('Starter');
    await click('Next');
    await click('Create tenant');
    await waitFor(() => expect(heading('Plan & quotas')).toBeTruthy());
    expect(input('VM quota').getAttribute('aria-invalid')).toBe('true');
    expect(within(wizard()).getByText('Some fields need attention.')).toBeTruthy();
    expect(within(wizard()).queryByText('server text')).toBeNull(); // H14
  });

  it('MSG-3: any other failure shows the mapped message on Review and keeps the values', async () => {
    await openWizard({ api: createFakeApi({ fail: { createTenant: { status: 500, code: 'INTERNAL' } } }) });
    await fillDetails();
    await pickPlan('Starter');
    await click('Next');
    await click('Create tenant');
    expect(await within(wizard()).findByRole('alert')).toBeTruthy();
    expect(within(wizard()).getByRole('alert').textContent).toBe('Something went wrong on our side. Try again.');
    expect(heading('Review')).toBeTruthy();
    expect(within(wizard()).getAllByText('new-co')).toHaveLength(2); // name, and display name defaulting to it
  });

  it('AC-TEN-2.5: two quick clicks on Create tenant send one request', async () => {
    const { api } = await openWizard({ api: createFakeApi({ hang: ['createTenant'] }) });
    await fillDetails();
    await pickPlan('Starter');
    await click('Next');
    const submit = within(wizard()).getByRole('button', { name: 'Create tenant' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(submit.getAttribute('aria-busy')).toBe('true'));
    fireEvent.click(submit);
    expect(api.count('/api/tenants', 'POST')).toBe(1);
  });

  it('AC-TEN-2.6: focus moves to the step heading on each step change', async () => {
    await openWizard();
    await fillDetails();
    expect(document.activeElement).toBe(heading('Plan & quotas'));
    await click('Back');
    expect(document.activeElement).toBe(heading('Details'));
  });

  it('AC-TEN-2.6: Escape on a dirty wizard asks to discard; Cancel keeps it, Discard closes it and focus returns to Create tenant', async () => {
    await openWizard();
    await userEvent.type(input('Name'), 'x');
    fireEvent.keyDown(wizard(), { key: 'Escape' });
    const prompt = await screen.findByRole('dialog', { name: 'Discard changes?' });
    await userEvent.click(within(prompt).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Discard changes?' })).toBeNull();
    expect(input('Name').value).toBe('x');

    fireEvent.keyDown(wizard(), { key: 'Escape' });
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Discard changes?' })).getByRole('button', { name: 'Discard' }));
    expect(screen.queryByRole('dialog', { name: 'Create tenant' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Create tenant' }));

    await userEvent.click(screen.getByRole('button', { name: 'Create tenant' })); // starts clean
    expect(input('Name').value).toBe('');
  });

  it('AC-TEN-2.6: Escape on a clean wizard closes it without asking', async () => {
    await openWizard();
    fireEvent.keyDown(wizard(), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Create tenant' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Discard changes?' })).toBeNull();
  });

  it('AC-TEN-2.7: creating publishes task:started with the provisioning task, toasts, and puts the tenant at the top of the list without a refetch', async () => {
    const { api, remote } = await openWizard();
    const lists = api.count('/api/tenants');
    await fillDetails();
    await pickPlan('Starter');
    await click('Next');
    await click('Create tenant');

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Create tenant' })).toBeNull());
    const started = remote.fake.published.find((p) => p.type === 'task:started')?.payload as { task: { kind: string; resource: { name: string } } };
    expect(started.task).toMatchObject({ kind: 'tenant.provision', resource: { name: 'new-co' } });
    expect(remote.fake.published).toContainEqual(expect.objectContaining({ type: 'toast:show', payload: expect.objectContaining({ kind: 'success', message: 'Tenant new-co created.' }) }));
    const rows = within(screen.getByRole('table', { name: 'Tenants' })).getAllByRole('row');
    expect(rows[1]?.textContent).toContain('new-co'); // first data row (D7-04)
    expect(rows[1]?.textContent).toContain('Provisioning');
    expect(screen.getByText('Showing 101 of 251 tenants')).toBeTruthy();
    expect(api.count('/api/tenants')).toBe(lists);
    expect(api.requests.find((r) => r.method === 'POST')?.body).toEqual({ name: 'new-co', adminEmail: 'admin@new-co.test', planId: 'p_starter', storageQuotaBytes: 50 * 1024 ** 3, vmQuota: 5 });
  });

  it('RBAC-4: without tenant:create there is no Create tenant button', async () => {
    renderArea('/', { permissions: READ_ONLY });
    await screen.findByText('Showing 100 of 250 tenants');
    expect(screen.queryByRole('button', { name: 'Create tenant' })).toBeNull();
  });
});
