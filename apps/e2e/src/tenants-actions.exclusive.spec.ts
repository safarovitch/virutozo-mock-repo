// SPEC-TEN-2 submits and SPEC-TEN-4 suspend / resume (E2E-2, E2E-3). Creating a tenant changes the list
// total the parallel suite asserts, and fail-next-task is global, so these run in the `exclusive` project
// (D7-16). Suspends use a generated tenant, never acme; the seed is reset afterwards (A6-05).
import { expect, test, type Page } from '@playwright/test';
import { api, expectNoA11yViolations, resetSeed, signIn } from './support';

test.afterAll(async ({ request }) => resetSeed(request));

const wizard = (page: Page) => page.getByRole('dialog', { name: 'Create tenant' });
const grid = (page: Page) => page.getByRole('table', { name: 'Tenants' });
const row = (page: Page, name: string) => grid(page).getByRole('row').filter({ has: page.getByRole('cell', { name, exact: true }) });

async function createThroughWizard(page: Page, name: string) {
  await page.getByRole('button', { name: 'Create tenant' }).click();
  await wizard(page).getByLabel('Name', { exact: true }).fill(name);
  await wizard(page).getByLabel('Admin email').fill(`admin@${name}.test`);
  await wizard(page).getByRole('button', { name: 'Next' }).click();
  await wizard(page).getByRole('radio', { name: /^Starter/ }).check();
  await wizard(page).getByRole('button', { name: 'Next' }).click();
  await expect(wizard(page).getByRole('heading', { name: 'Review' })).toBeVisible();
  await wizard(page).getByRole('button', { name: 'Create tenant' }).click();
}

/** An active generated tenant, found through the API and then by search in the list. */
async function activeTenant(page: Page): Promise<string> {
  const { body } = await api<{ items: { name: string }[] }>(page, 'GET', '/tenants?status=active&sort=-createdAt&limit=5');
  const name = body.items.find((t) => t.name !== 'acme')?.name as string;
  await page.goto(`/tenants?q=${name}`);
  await expect(row(page, name)).toBeVisible();
  return name;
}

async function suspendFromMenu(page: Page, name: string) {
  await row(page, name).getByRole('button', { name: `Actions for ${name}` }).click();
  await row(page, name).getByRole('button', { name: 'Suspend' }).click();
  const dialog = page.getByRole('dialog', { name: `Suspend ${name}?` });
  const confirm = dialog.getByRole('button', { name: 'Suspend tenant' });
  await expect(confirm).toBeDisabled(); // AC-TEN-4.1
  await dialog.getByLabel(`Type ${name} to confirm.`).fill(name.toUpperCase());
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(`Type ${name} to confirm.`).fill(name);
  await expect(confirm).toBeEnabled();
  await expectNoA11yViolations(page);
  await confirm.click();
}

test('AC-TEN-2.4: creating "acme" returns to step 1 with "This name is already taken." (E2E-2)', async ({ page }) => {
  await signIn(page, 'provider_admin');
  await page.goto('/tenants');
  await createThroughWizard(page, 'acme');
  await expect(wizard(page).getByRole('heading', { name: 'Details' })).toBeVisible();
  await expect(wizard(page).getByText('This name is already taken.')).toBeVisible();
});

test('AC-TEN-2.7: a created tenant tops the list as Provisioning, its task is in the task center, then it becomes Active (E2E-2)', async ({ page }) => {
  await signIn(page, 'provider_admin');
  await page.goto('/tenants');
  await expect(page.getByText('Showing 100 of 10,000 tenants')).toBeVisible();
  await createThroughWizard(page, 'e2e-new-co');
  await expect(wizard(page)).toBeHidden();
  await expect(page.getByText('Tenant e2e-new-co created.')).toBeVisible();
  const body = grid(page).getByRole('rowgroup').nth(1).getByRole('row');
  await expect(body.first()).toContainText('e2e-new-co');
  await expect(body.first()).toContainText('Provisioning');
  await expect(page.getByText('Showing 101 of 10,001 tenants')).toBeVisible();
  await page.getByRole('button', { name: /^Tasks/ }).click();
  await expect(page.getByRole('progressbar', { name: 'Provision tenant: e2e-new-co' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(body.first()).toContainText('Active', { timeout: 10_000 });
});

test('AC-TEN-4.2: suspending from the row menu shows Suspending…, a task in the task center, then Suspended (E2E-3)', async ({ page }) => {
  await signIn(page, 'provider_admin');
  const name = await activeTenant(page);
  await suspendFromMenu(page, name);
  await expect(row(page, name)).toContainText('Suspending…');
  await page.getByRole('button', { name: /^Tasks/ }).click();
  await expect(page.getByRole('progressbar', { name: `Suspend tenant: ${name}` })).toBeVisible(); // AC-TEN-4.5
  await page.keyboard.press('Escape');
  await expect(row(page, name)).toContainText('Suspended', { timeout: 10_000 });
  await expect(page.getByText(`Tenant ${name} suspended.`)).toBeVisible();

  // AC-TEN-4.6: and back.
  await row(page, name).getByRole('button', { name: `Actions for ${name}` }).click();
  await row(page, name).getByRole('button', { name: 'Resume' }).click();
  await page.getByRole('dialog', { name: `Resume ${name}?` }).getByRole('button', { name: 'Resume tenant' }).click();
  await expect(row(page, name)).toContainText('Resuming…');
  await expect(row(page, name)).toContainText('Active', { timeout: 10_000 });
  await expect(page.getByText(`Tenant ${name} resumed.`)).toBeVisible();
});

test('AC-TEN-4.3: a failed suspend task leaves the row Active and shows the mapped message', async ({ page }) => {
  await signIn(page, 'provider_admin');
  const name = await activeTenant(page);
  const forced = await page.evaluate(
    async () => (await fetch('/api/__test/fail-next-task', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'tenant.suspend', code: 'INTERNAL' }) })).status,
  );
  expect(forced).toBe(204);
  await suspendFromMenu(page, name);
  await expect(row(page, name)).toContainText('Suspending…');
  await expect(page.getByRole('region', { name: 'Notifications' }).getByText('Something went wrong on our side. Try again.')).toBeVisible({ timeout: 10_000 });
  await expect(row(page, name)).toContainText('Active');
  await expect(row(page, name)).not.toContainText('Suspending…');
});

test("AC-TEN-4.4: a reseller_admin sees Suspend disabled with \"You don't have permission to suspend tenants.\"", async ({ page }) => {
  await signIn(page, 'reseller_admin');
  await page.goto('/tenants?q=acme');
  await row(page, 'acme').getByRole('button', { name: 'Actions for acme' }).click();
  const suspend = row(page, 'acme').getByRole('button', { name: 'Suspend' });
  await expect(suspend).toHaveAttribute('aria-disabled', 'true');
  await expect(suspend).toHaveAccessibleDescription("You don't have permission to suspend tenants.");
});
