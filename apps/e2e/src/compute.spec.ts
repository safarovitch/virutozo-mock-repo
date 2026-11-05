// SPEC-CMP-1/2/5 and SPEC-SHL-8 (header), against the gateway. Workers share one mock-api: these tests
// only read. Tests that run real VM tasks are in compute.exclusive.spec.ts (D6-16, A6-05).
import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations, signIn } from './support';

const table = (page: Page) => page.getByRole('table', { name: 'Virtual machines' });
const row = (page: Page, name: string) => table(page).getByRole('row').filter({ has: page.getByRole('rowheader', { name, exact: true }) });

test('NFR-A11Y-1: a tenant_admin sees acme\'s 40 VMs with status text and no serious axe violations', async ({ page }) => {
  await signIn(page, 'tenant_admin');
  await page.goto('/compute');
  await expect(table(page).getByRole('row')).toHaveCount(41);
  await expect(row(page, 'web-01')).toContainText('Running');
  await expectNoA11yViolations(page);
});

test('AC-SHL-8.1: a tenant_viewer sees "Acme Corporation · Business · Active" in the header', async ({ page }) => {
  await signIn(page, 'tenant_viewer');
  await expect(page.getByRole('banner')).toContainText('Acme Corporation · Business · Active');
});

test('AC-CMP-2.3: a tenant_viewer sees no VM action buttons (E2E-5)', async ({ page }) => {
  await signIn(page, 'tenant_viewer');
  await page.goto('/compute');
  await expect(row(page, 'web-01')).toContainText('Running');
  await expect(page.getByRole('button', { name: /^(Start|Stop|Reboot)$/ })).toHaveCount(0);
});

test('AC-CMP-5.1: /compute/vm_01 opens the drawer for web-01, also after a reload', async ({ page }) => {
  await signIn(page, 'tenant_admin');
  await page.goto('/compute/vm_01');
  const drawer = page.getByRole('dialog', { name: 'web-01' });
  await expect(drawer).toContainText('IP address');
  await page.reload();
  await expect(drawer).toContainText('IP address');
  await expectNoA11yViolations(page);
  await drawer.getByRole('button', { name: 'Close' }).click();
  await expect(page).toHaveURL(/\/compute$/);
  await page.goBack(); // url-conventions: closing pushed the list URL, so Back reopens the drawer
  await expect(drawer).toBeVisible();
});

test('AC-CMP-5.2: a non-existent VM ID shows errors.NOT_FOUND', async ({ page }) => {
  await signIn(page, 'tenant_admin');
  await page.goto('/compute/vm_99');
  await expect(page.getByRole('dialog')).toContainText('This item no longer exists.');
});

test('AC-CMP-5.4: a provider_admin opening /compute/vm_01 ends on ?tenantId=t_acme with acme\'s list behind the drawer', async ({ page }) => {
  await signIn(page, 'provider_admin');
  await page.goto('/compute/vm_01');
  await expect(page).toHaveURL(/\/compute\/vm_01\?tenantId=t_acme$/);
  await expect(page.getByRole('dialog', { name: 'web-01' })).toBeVisible();
  await expect(table(page).getByRole('row')).toHaveCount(41);
});


test('AC-CMP-2.5: Stop asks for confirmation, and Cancel changes nothing', async ({ page }) => {
  await signIn(page, 'tenant_admin');
  await page.goto('/compute');
  await row(page, 'web-01').getByRole('button', { name: 'Stop' }).click();
  const dialog = page.getByRole('dialog', { name: 'Stop web-01?' });
  await expect(dialog).toContainText('Anything running on web-01 will stop.');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(row(page, 'web-01')).toContainText('Running');
});
