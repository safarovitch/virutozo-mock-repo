// SPEC-TEN-1 tests whose events reach other sessions (D6-16, A6-05). AC-TEN-1.6 emits a tenant.updated
// for acme without storing it; since SPEC-SHL-8 every acme tenant session shows it in its header and
// disables its actions, so it runs in the `exclusive` project, after the parallel suite. Unchanged from
// tenants.spec.ts.
import { expect, test, type Page } from '@playwright/test';
import { resetSeed, signIn } from './support';

test.afterAll(async ({ request }) => resetSeed(request)); // A6-05

const grid = (page: Page) => page.getByRole('table', { name: 'Tenants' });
/** Body rows: the second row group (the first is the header). */
const bodyRows = (page: Page) => grid(page).getByRole('rowgroup').nth(1).getByRole('row');

test('AC-TEN-1.6: a tenant.updated event changes the row badge without refetching the list', async ({ page }) => {
  await signIn(page, 'provider_admin');
  await page.goto('/tenants?q=acme');
  const row = bodyRows(page).filter({ hasText: 'Acme Corporation' });
  await expect(row).toContainText('Active');
  let listRequests = 0;
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/tenants') listRequests++;
  });
  // Emit only (the stored tenant doesn't change), so no other test sees a suspended acme.
  const status = await page.evaluate(
    async () =>
      (await fetch('/api/__test/emit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'tenant.updated', tenant: { id: 't_acme', status: 'suspended' } }) })).status,
  );
  expect(status).toBe(204);
  await expect(row).toContainText('Suspended');
  expect(listRequests).toBe(0);
});
