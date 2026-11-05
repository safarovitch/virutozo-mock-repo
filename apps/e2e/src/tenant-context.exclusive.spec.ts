// E2E-10 (tenant side, D6-01): suspending acme changes data every tenant-role test reads, so this file
// runs in the `exclusive` project, after the parallel suite, with one worker (D6-16). Until SPEC-TEN-4
// (Day 7) the provider suspends through the API in a second browser context.
import { expect, test, type Browser, type Page } from '@playwright/test';
import { api, resetSeed, signIn } from './support';

async function providerPage(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await signIn(page, 'provider_admin');
  return page;
}

async function resumeAcme(page: Page) {
  const tenant = await api<{ status: string }>(page, 'GET', '/tenants/t_acme');
  if (tenant.body.status === 'suspended') expect((await api(page, 'POST', '/tenants/t_acme/resume')).status).toBe(202);
  await expect.poll(async () => (await api<{ status: string }>(page, 'GET', '/tenants/t_acme')).body.status, { timeout: 10_000 }).toBe('active');
}

test.afterAll(async ({ request }) => resetSeed(request)); // always leave acme active for later runs (A6-05)

test('AC-SHL-8.2: when acme is suspended, the tenant_admin sees Suspended, the banner and disabled VM actions without a reload (E2E-10)', async ({ page, browser }) => {
  const provider = await providerPage(browser);
  await resumeAcme(provider);
  await signIn(page, 'tenant_admin');
  await page.goto('/compute');
  const reboot = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'web-01', exact: true }) }).getByRole('button', { name: 'Reboot' });
  await expect(reboot).not.toHaveAttribute('aria-disabled', 'true');

  expect((await api(provider, 'POST', '/tenants/t_acme/suspend')).status).toBe(202);
  await expect(page.getByRole('banner')).toContainText('Acme Corporation · Business · Suspended', { timeout: 10_000 });
  const banner = page.getByRole('status').getByText("This tenant is suspended. You can view resources but can't change them."); // the same text is every button's tooltip
  await expect(banner).toBeVisible();
  await expect(reboot).toHaveAttribute('aria-disabled', 'true');
  await expect(reboot).toHaveAccessibleDescription("This tenant is suspended. You can view resources but can't change them.");

  expect((await api(provider, 'POST', '/tenants/t_acme/resume')).status).toBe(202);
  await expect(page.getByRole('banner')).toContainText('Acme Corporation · Business · Active', { timeout: 10_000 });
  await expect(banner).toBeHidden();
  await expect(reboot).not.toHaveAttribute('aria-disabled', 'true');
});
