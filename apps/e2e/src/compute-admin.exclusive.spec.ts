// SPEC-CMP-4 journeys that change acme (a real reboot of web-01, suspending acme), so they run in the
// `exclusive` project and reset the seed afterwards (D8-18, A6-05).
import { expect, test, type Browser, type Page } from '@playwright/test';
import { api, ensureRunning, resetSeed, signIn } from './support';

test.afterAll(async ({ request }) => resetSeed(request));

async function newPage(browser: Browser, role: Parameters<typeof signIn>[1]): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await signIn(page, role);
  return page;
}

test('AC-CMP-4.3: a provider_admin picks acme, opens web-01, reboots it after a confirmation naming the tenant and sees live progress (E2E-11)', async ({ page, browser }) => {
  const tenantAdmin = await newPage(browser, 'tenant_admin');
  await ensureRunning(tenantAdmin, 'web-01');
  await signIn(page, 'provider_admin');
  await page.goto('/compute');
  await page.getByRole('combobox', { name: 'Tenant' }).fill('acme');
  await page.getByRole('option', { name: /Acme Corporation/ }).click();
  await page.getByRole('table', { name: 'Virtual machines' }).getByRole('link', { name: 'web-01', exact: true }).click();
  await expect(page).toHaveURL(/\/compute\/vm_01\?tenantId=t_acme$/);
  const drawer = page.getByRole('dialog', { name: 'web-01' });
  await drawer.getByRole('button', { name: 'Reboot' }).click();
  const confirm = page.getByRole('dialog', { name: 'Reboot web-01 on tenant Acme Corporation?' });
  await confirm.getByRole('button', { name: 'Reboot' }).click();
  const bar = drawer.getByRole('progressbar', { name: 'Reboot VM: web-01' });
  await expect(bar).toHaveAttribute('aria-valuenow', /\d+/, { timeout: 8_000 });
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'web-01' })).toBeVisible(); // the drawer is URL state
  await expect(page.getByText('web-01 rebooted.').or(page.getByRole('dialog', { name: 'web-01' }).getByText('Running'))).toBeVisible({ timeout: 15_000 });
});

test('AC-CMP-4.4: with suspended acme picked, the provider sees the admin banner and disabled actions; AC-CMP-4.5: a resume elsewhere clears them (E2E-10)', async ({ page, browser }) => {
  await signIn(page, 'provider_admin');
  expect((await api(page, 'POST', '/tenants/t_acme/suspend')).status).toBe(202);
  await expect.poll(async () => (await api<{ status: string }>(page, 'GET', '/tenants/t_acme')).body.status, { timeout: 10_000 }).toBe('suspended');
  await page.goto('/compute?tenantId=t_acme');
  const banner = page.getByRole('status').filter({ hasText: 'Acme Corporation is suspended. Resume it to make changes.' });
  await expect(banner).toBeVisible();
  await expect(banner.getByRole('link', { name: 'Open tenant' })).toBeVisible();
  const reboot = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'web-01', exact: true }) }).getByRole('button', { name: 'Reboot' });
  await expect(reboot).toHaveAttribute('aria-disabled', 'true');
  await expect(reboot).toHaveAccessibleDescription('Changes are disabled while this tenant is suspended.');

  // Another provider tab resumes acme through the tenants UI (SPEC-TEN-4).
  const other = await newPage(browser, 'provider_admin');
  await other.goto('/tenants/t_acme');
  await other.getByRole('dialog', { name: /Acme Corporation|acme/ }).getByRole('button', { name: 'Resume' }).click();
  await other.getByRole('dialog', { name: 'Resume acme?' }).getByRole('button', { name: 'Resume tenant' }).click();

  await expect(banner).toBeHidden({ timeout: 10_000 });
  await expect(reboot).not.toHaveAttribute('aria-disabled', 'true');
});
