// SPEC-STO-1 / SPEC-STO-3 journeys that only read (E2E-12). Changes to acme's buckets run in
// storage.exclusive.spec.ts (D8-18).
import { expect, test, type Browser, type Page } from '@playwright/test';
import { api, expectNoA11yViolations, signIn } from './support';

const buckets = (page: Page) => page.getByRole('table', { name: 'Buckets' });
const usage = (page: Page) => page.getByRole('region', { name: 'Storage usage' });

/** A tenant outside Northwind's scope, found with a provider session (scoping is the server's, AC-STO-3.3). */
async function foreignTenantId(browser: Browser): Promise<string> {
  const context = await browser.newContext();
  const provider = await context.newPage();
  await signIn(provider, 'provider_admin');
  const { body } = await api<{ items: { id: string; resellerId: string | null }[] }>(provider, 'GET', '/tenants?limit=50');
  await context.close();
  return (body.items.find((t) => t.resellerId !== 'r_northwind') as { id: string }).id;
}

test('AC-STO-1.2: a tenant_admin sees acme\'s buckets with formatted sizes, the 82% usage card and no serious axe violations', async ({ page }) => {
  await signIn(page, 'tenant_admin');
  await page.goto('/storage');
  await expect(buckets(page).getByRole('cell', { name: 'acme-backups', exact: true })).toBeVisible();
  await expect(buckets(page).getByRole('row').filter({ has: page.getByRole('cell', { name: 'acme-backups', exact: true }) })).toContainText('80 GiB');
  await expect(buckets(page).getByRole('row').filter({ has: page.getByRole('cell', { name: 'acme-scratch', exact: true }) })).toContainText('0 B');
  await expect(usage(page)).toContainText('205 GiB of 250 GiB');
  await expect(usage(page)).toContainText('82% of quota used');
  await expectNoA11yViolations(page);
});

test('AC-STO-3.2: a reseller_admin picks acme in Storage and sees its buckets and usage card, read-only (E2E-12)', async ({ page }) => {
  await signIn(page, 'reseller_admin');
  await page.goto('/storage');
  await expect(page.getByRole('heading', { name: 'Choose a tenant to see its buckets.' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Tenant' }).fill('acme');
  await page.getByRole('option', { name: /Acme Corporation/ }).click();
  await expect(page).toHaveURL(/\/storage\?tenantId=t_acme$/);
  await expect(buckets(page).getByRole('cell', { name: 'acme-scratch', exact: true })).toBeVisible();
  await expect(usage(page)).toContainText('82% of quota used');
  await expect(page.getByRole('button', { name: 'Create bucket' })).toHaveCount(0);
  await expect(buckets(page).getByRole('button')).toHaveCount(0);
});

test('AC-STO-3.3: a foreign tenantId in /storage?tenantId= shows "This item no longer exists." (E2E-12)', async ({ page, browser }) => {
  const foreign = await foreignTenantId(browser);
  await signIn(page, 'reseller_admin');
  await page.goto(`/storage?tenantId=${foreign}`);
  await expect(page.getByRole('alert').filter({ hasText: 'This item no longer exists.' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Tenant' })).toBeEnabled();
});

test('AC-STO-3.1: a provider_admin picking acme sees its buckets and usage card without create or delete', async ({ page }) => {
  await signIn(page, 'provider_admin');
  await page.goto('/storage');
  await page.getByRole('combobox', { name: 'Tenant' }).fill('acme');
  await page.getByRole('option', { name: /Acme Corporation/ }).click();
  await expect(buckets(page).getByRole('cell', { name: 'acme-assets', exact: true })).toBeVisible();
  await expect(usage(page)).toContainText('205 GiB of 250 GiB');
  await expect(page.getByRole('button', { name: 'Create bucket' })).toHaveCount(0);
  await expect(buckets(page).getByRole('button')).toHaveCount(0);
});
