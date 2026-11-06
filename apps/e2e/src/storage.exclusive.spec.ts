// SPEC-STO-2 journeys that change acme's buckets or usage, which every acme session sees. They run in
// the `exclusive` project and reset the seed afterwards (D8-18, A6-05).
import { expect, test, type Page } from '@playwright/test';
import { resetSeed, signIn } from './support';

test.afterAll(async ({ request }) => resetSeed(request));
test.beforeEach(async ({ request }) => resetSeed(request)); // each test starts from acme's seeded buckets

const buckets = (page: Page) => page.getByRole('table', { name: 'Buckets' });
const cell = (page: Page, name: string) => buckets(page).getByRole('cell', { name, exact: true });
const usage = (page: Page) => page.getByRole('region', { name: 'Storage usage' });

async function openStorage(page: Page) {
  await signIn(page, 'tenant_admin');
  await page.goto('/storage');
  await expect(cell(page, 'acme-assets')).toBeVisible();
}

async function createBucket(page: Page, name: string, versioning = false) {
  await page.getByRole('button', { name: 'Create bucket' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Create bucket' });
  await dialog.getByRole('textbox', { name: 'Name' }).fill(name);
  if (versioning) await dialog.getByRole('switch', { name: 'Versioning' }).check();
  await dialog.getByRole('button', { name: 'Create bucket' }).click();
  return dialog;
}

test('AC-STO-2.6: creating a bucket with Versioning on lists it with Versioning "On" (AC-STO-1.4)', async ({ page }) => {
  await openStorage(page);
  const dialog = await createBucket(page, 'acme-e2e-versioned', true);
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Bucket acme-e2e-versioned created.')).toBeVisible();
  await expect(buckets(page).getByRole('row').filter({ has: page.getByRole('cell', { name: 'acme-e2e-versioned', exact: true }) })).toContainText('On');
});

test('AC-STO-2.1: an invalid name shows the field error and sends nothing; AC-STO-2.2: an IP-shaped name is rejected', async ({ page }) => {
  await openStorage(page);
  let posts = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/buckets') posts++;
  });
  const dialog = await createBucket(page, 'My_Bucket');
  await expect(dialog.getByText('Use 3–63 lowercase letters, numbers, dots and hyphens.')).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Name' }).fill('192.168.1.1');
  await dialog.getByRole('button', { name: 'Create bucket' }).click();
  await expect(dialog.getByText("Bucket names can't look like IP addresses.")).toBeVisible();
  expect(posts).toBe(0);
});

test('AC-STO-2.3: with the quota fully used, creating a bucket shows errors.QUOTA_EXCEEDED in the dialog', async ({ page, request }) => {
  await openStorage(page);
  expect((await request.post('/api/__test/set-usage', { data: { tenantId: 't_acme', usedBytes: 250 * 1024 ** 3 } })).status()).toBe(204);
  await expect(usage(page)).toContainText('100% of quota used'); // quota.updated (AC-STO-1.4)
  const dialog = await createBucket(page, 'acme-e2e-full');
  await expect(dialog.getByRole('alert')).toHaveText('Storage quota is full. Free up space or ask an admin to raise the quota.');
  await expect(dialog.getByRole('textbox', { name: 'Name' })).toHaveValue('acme-e2e-full');
});

test('AC-STO-2.4: deleting a non-empty bucket shows errors.BUCKET_NOT_EMPTY and keeps the dialog open', async ({ page }) => {
  await openStorage(page);
  await page.getByRole('button', { name: 'Delete acme-backups' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete acme-backups?' });
  await dialog.getByLabel('Type acme-backups to confirm.').fill('acme-backups');
  await dialog.getByRole('button', { name: 'Delete bucket' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Empty the bucket before deleting it.');
  await expect(dialog).toBeVisible();
  await expect(cell(page, 'acme-backups')).toBeAttached();
});

test('AC-STO-2.5: deleting the empty acme-scratch removes it and the toast confirms (AC-STO-1.4 in a second tab)', async ({ page, context }) => {
  await openStorage(page);
  const other = await context.newPage(); // same session, another tab: learns of the delete from bucket.updated
  await other.goto('/storage');
  await expect(cell(other, 'acme-scratch')).toBeVisible();
  await page.getByRole('button', { name: 'Delete acme-scratch' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete acme-scratch?' });
  await dialog.getByLabel('Type acme-scratch to confirm.').fill('acme-scratch');
  await dialog.getByRole('button', { name: 'Delete bucket' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Bucket acme-scratch deleted.')).toBeVisible();
  await expect(cell(page, 'acme-scratch')).toHaveCount(0);
  await expect(cell(other, 'acme-scratch')).toHaveCount(0);
});
