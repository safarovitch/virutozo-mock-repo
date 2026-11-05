// SPEC-TEN-1 (tenant list) and SPEC-TEN-3 (tenant drawer), against the gateway. Workers share one
// mock-api, so these tests never change data that other tests read.
import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations, signIn } from './support';

const grid = (page: Page) => page.getByRole('table', { name: 'Tenants' });
/** Body rows: the second row group (the first is the header). */
const bodyRows = (page: Page) => grid(page).getByRole('rowgroup').nth(1).getByRole('row');
const count = (page: Page) => page.getByText(/^Showing [\d,]+ of [\d,]+ tenants$/);
const drawer = (page: Page) => page.getByRole('dialog');

async function scrollTableToEnd(page: Page) {
  await grid(page).evaluate((table) => {
    const scroller = table.parentElement as HTMLElement;
    scroller.scrollTop = scroller.scrollHeight;
  });
}

test('AC-TEN-1.1: scrolling 10,000 tenants keeps at most 60 rows in the DOM', async ({ page }) => {
  await signIn(page, 'provider_admin');
  await page.goto('/tenants');
  await expect(count(page)).toHaveText('Showing 100 of 10,000 tenants');
  for (let shown = 200; shown <= 500; shown += 100) {
    await scrollTableToEnd(page);
    await expect(count(page)).toHaveText(`Showing ${shown} of 10,000 tenants`);
    expect(await bodyRows(page).count()).toBeLessThanOrEqual(60);
  }
});

test('AC-TEN-1.2: searching "acme" puts ?q=acme in the URL and shows acme', async ({ page }) => {
  await signIn(page, 'provider_admin');
  await page.goto('/tenants');
  await expect(count(page)).toHaveText('Showing 100 of 10,000 tenants');
  const requests: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/tenants') requests.push(r.url());
  });
  await page.getByRole('searchbox', { name: 'Search tenants' }).pressSequentially('acme', { delay: 50 });
  await expect(page).toHaveURL(/\/tenants\?q=acme$/);
  await expect(bodyRows(page).first()).toContainText('Acme Corporation');
  expect(requests.filter((u) => new URL(u).searchParams.has('q'))).toHaveLength(1);
});

test('AC-TEN-1.3: clicking Name sorts descending, with aria-sort and the URL', async ({ page }) => {
  await signIn(page, 'provider_admin');
  await page.goto('/tenants');
  const header = page.getByRole('columnheader', { name: /Name/ });
  await expect(header).toHaveAttribute('aria-sort', 'ascending');
  await header.getByRole('button').click();
  await expect(header).toHaveAttribute('aria-sort', 'descending');
  await expect(page).toHaveURL(/\/tenants\?sort=-name$/);
  await page.goBack(); // D5-04: Back undoes one sort change
  await expect(header).toHaveAttribute('aria-sort', 'ascending');
});

test('AC-TEN-1.4: /tenants?status=suspended&sort=-createdAt shows the filter and sort from the URL', async ({ page }) => {
  await signIn(page, 'provider_admin');
  await page.goto('/tenants?status=suspended&sort=-createdAt');
  await expect(page.getByRole('combobox', { name: 'Status' })).toHaveValue('suspended');
  await expect(page.getByRole('columnheader', { name: /Created/ })).toHaveAttribute('aria-sort', 'descending');
  await expect(count(page)).toHaveText('Showing 100 of 800 tenants');
  await expect(bodyRows(page).first()).toContainText('Suspended');
});

test('AC-TEN-1.5: a reseller_admin sees only their own tenants', async ({ page, browser }) => {
  // A tenant of another reseller, looked up with a provider session in its own browser context.
  const provider = await browser.newContext();
  const providerPage = await provider.newPage();
  await signIn(providerPage, 'provider_admin');
  const foreign = await providerPage.evaluate(async () => {
    const res = await fetch('/api/tenants?limit=200');
    const page = (await res.json()) as { items: { id: string; name: string; resellerId: string | null }[] };
    return page.items.find((t) => t.resellerId !== 'r_northwind') as { id: string; name: string };
  });
  await provider.close();

  await signIn(page, 'reseller_admin');
  await page.goto('/tenants');
  await expect(count(page)).toHaveText('Showing 100 of 1,200 tenants');
  await page.getByRole('searchbox', { name: 'Search tenants' }).fill(foreign.name);
  await expect(page.getByRole('heading', { name: 'No tenants match your filters' })).toBeVisible();
  await page.goto(`/tenants/${foreign.id}`);
  await expect(drawer(page).getByRole('heading', { name: 'This item no longer exists.' })).toBeVisible();
});


test('AC-TEN-1.7: Tab into the table, arrow keys move between rows, Enter opens the drawer', async ({ page }) => {
  await signIn(page, 'provider_admin');
  await page.goto('/tenants');
  await expect(count(page)).toHaveText('Showing 100 of 10,000 tenants');
  await page.getByRole('columnheader', { name: /Created/ }).getByRole('button').focus();
  await page.keyboard.press('Tab');
  await expect(bodyRows(page).first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  const second = bodyRows(page).nth(1);
  await expect(second).toBeFocused();
  const name = (await second.getByRole('cell').first().textContent()) ?? '';
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/tenants\/t_[a-z0-9]+$/);
  await expect(drawer(page).getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  await expect(drawer(page)).toContainText(name);
});

test('AC-TEN-3.1: opening /tenants/t_acme directly shows the list with the drawer open', async ({ page }) => {
  await signIn(page, 'provider_admin');
  await page.goto('/tenants/t_acme');
  await expect(drawer(page).getByRole('heading', { name: 'Acme Corporation' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tenants', exact: true })).toBeAttached();
  await expect(bodyRows(page).first()).toBeAttached();
  await expectNoA11yViolations(page);
});

test('AC-TEN-3.2: lowering the storage quota below usage blocks the save with "(205 GiB)"', async ({ page }) => {
  await signIn(page, 'reseller_admin');
  await page.goto('/tenants/t_acme?tab=quotas');
  const storage = drawer(page).getByRole('spinbutton', { name: 'Storage quota (GiB)' });
  await expect(storage).toHaveValue('250');
  await storage.fill('200');
  await drawer(page).getByRole('button', { name: 'Save quotas' }).click();
  await expect(drawer(page).getByText("Storage quota can't be lower than current usage (205 GiB).")).toBeVisible();
  await expect(storage).toHaveAttribute('aria-invalid', 'true');
});

test('AC-TEN-3.7: opening a non-existent tenant shows the drawer\'s not-found state', async ({ page }) => {
  await signIn(page, 'provider_admin');
  await page.goto('/tenants/t_zzzzz');
  await expect(drawer(page).getByRole('heading', { name: 'This item no longer exists.' })).toBeVisible();
});

test('AC-TEN-3.12: switching tabs adds no history entries; Back closes the drawer', async ({ page }) => {
  await signIn(page, 'provider_admin');
  await page.goto('/tenants?q=acme');
  await bodyRows(page).filter({ hasText: 'Acme Corporation' }).click();
  await expect(page).toHaveURL(/\/tenants\/t_acme\?q=acme$/);
  await drawer(page).getByRole('tab', { name: 'Quotas' }).click();
  await expect(page).toHaveURL(/\/tenants\/t_acme\?q=acme&tab=quotas$/);
  await drawer(page).getByRole('tab', { name: 'Activity' }).click();
  await expect(page).toHaveURL(/tab=activity$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/tenants\?q=acme$/);
  await expect(drawer(page)).toBeHidden();
});

test('AC-TEN-3.13: /tenants/t_acme?tab=bogus shows Overview and the URL becomes /tenants/t_acme', async ({ page }) => {
  await signIn(page, 'provider_admin');
  await page.goto('/tenants/t_acme?tab=bogus');
  await expect(page).toHaveURL(/\/tenants\/t_acme$/);
  await expect(drawer(page).getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
});

test('AC-SHL-1.3: after a provider_admin signs out, a tenant_viewer sees no tenant rows', async ({ page }) => {
  await signIn(page, 'provider_admin');
  await page.goto('/tenants');
  await expect(bodyRows(page).first()).toBeVisible();
  await page.getByRole('button', { name: /^Account: / }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
  await signIn(page, 'tenant_viewer');
  await page.goto('/tenants');
  await expect(page.getByRole('heading', { name: '403 – No access' })).toBeVisible();
  await expect(grid(page)).toHaveCount(0);
});

test('E2E-15: deep links survive a reload through the gateway (provider_admin)', async ({ page }) => {
  await signIn(page, 'provider_admin');
  for (const [path, area] of [
    ['/tenants/t_acme?tab=quotas', 'Tenants'],
    ['/compute/vm_01', 'Compute'],
    ['/storage?tenantId=t_acme', 'Storage'],
  ] as const) {
    await page.goto(path);
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`${path.replace(/[?]/g, '\\?')}$`));
    await expect(page.getByRole('heading', { name: area, exact: true })).toBeVisible();
  }
});
