// SPEC-TEN-2 checks that never submit, so they run in the parallel project (D7-16). Creating a tenant
// changes the list total other tests assert: that's in tenants-actions.exclusive.spec.ts.
import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations, signIn } from './support';

const wizard = (page: Page) => page.getByRole('dialog', { name: 'Create tenant' });

async function openWizard(page: Page) {
  await signIn(page, 'provider_admin');
  await page.goto('/tenants');
  await page.getByRole('button', { name: 'Create tenant' }).click();
  await expect(wizard(page)).toBeVisible();
}

async function details(page: Page, name = 'e2e-wizard') {
  await wizard(page).getByLabel('Name', { exact: true }).fill(name);
  await wizard(page).getByLabel('Admin email').fill('admin@e2e-wizard.test');
  await wizard(page).getByRole('button', { name: 'Next' }).click();
}

test('E2E-16: on Starter, 20 VMs and 200 GiB each block Next with the plan limit', async ({ page }) => {
  await openWizard(page);
  await details(page);
  await wizard(page).getByRole('radio', { name: /^Starter/ }).check();
  await wizard(page).getByLabel('VM quota').fill('20');
  await wizard(page).getByRole('button', { name: 'Next' }).click();
  await expect(wizard(page).getByText('Starter allows up to 10 VMs.')).toBeVisible(); // AC-TEN-2.8
  await wizard(page).getByLabel('VM quota').fill('5');
  await wizard(page).getByLabel('Storage quota (GiB)').fill('200');
  await wizard(page).getByRole('button', { name: 'Next' }).click();
  await expect(wizard(page).getByText('Starter allows up to 100 GiB.')).toBeVisible(); // AC-TEN-2.2
  await expect(wizard(page).getByRole('heading', { name: 'Plan & quotas' })).toBeVisible();
  await expectNoA11yViolations(page);
});

test('AC-TEN-2.1: "Acme Corp" keeps step 1 open with the name rule', async ({ page }) => {
  await openWizard(page);
  await details(page, 'Acme Corp');
  await expect(wizard(page).getByRole('heading', { name: 'Details' })).toBeVisible();
  await expect(wizard(page).getByText('Use lowercase letters, numbers and hyphens.')).toBeVisible();
  await expectNoA11yViolations(page);
});

test('AC-TEN-2.6: focus follows the step heading; Escape on a dirty wizard asks to discard; focus returns to Create tenant', async ({ page }) => {
  await openWizard(page);
  await details(page);
  await expect(wizard(page).getByRole('heading', { name: 'Plan & quotas' })).toBeFocused();
  await page.keyboard.press('Escape');
  const prompt = page.getByRole('dialog', { name: 'Discard changes?' });
  await expect(prompt).toBeVisible();
  await expectNoA11yViolations(page);
  await prompt.getByRole('button', { name: 'Discard' }).click();
  await expect(wizard(page)).toBeHidden();
  await expect(page.getByRole('button', { name: 'Create tenant' })).toBeFocused();
});
