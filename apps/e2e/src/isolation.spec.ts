// SPEC-SHL-4: one remote failing never takes the others down (E2E-6). Failures are simulated per page with
// page.route and each remote's /__crash route (D7-19), so nothing here affects other tests.
import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations, signIn, type Role } from './support';

const STORAGE = '**/remotes/storage/**';

/** What the shell's logger wrote for each crash (D7-18): `console.error('[nimbus][shell] remote.crashed', data)`. */
function crashLog(page: Page) {
  const entries: Promise<unknown>[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && msg.text().startsWith('[nimbus][shell] remote.crashed')) entries.push(msg.args()[1]?.jsonValue() ?? Promise.resolve(undefined));
  });
  return entries;
}

test('AC-SHL-4.1: with the storage remote down, /storage shows the panel with Retry and the shell stays usable (E2E-6)', async ({ page }) => {
  await signIn(page, 'tenant_admin');
  await page.route(STORAGE, (route) => route.fulfill({ status: 503 }));
  await page.goto('/storage');
  await expect(page.getByRole('heading', { name: 'Storage is temporarily unavailable.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Compute' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Compute' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Tasks/ })).toBeVisible();
});

test('AC-SHL-4.2: with storage down, /tenants and /compute each show their heading and at least one row (E2E-6)', async ({ page, browser }) => {
  await page.route(STORAGE, (route) => route.fulfill({ status: 503 }));
  await signIn(page, 'provider_admin');
  await page.goto('/storage');
  await expect(page.getByRole('heading', { name: 'Storage is temporarily unavailable.' })).toBeVisible();
  await page.goto('/tenants');
  await expect(page.getByRole('heading', { level: 1, name: 'Tenants' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Tenants' }).getByRole('rowgroup').nth(1).getByRole('row').first()).toBeVisible();

  const tenant = await (await browser.newContext()).newPage();
  await tenant.route(STORAGE, (route) => route.fulfill({ status: 503 }));
  await signIn(tenant, 'tenant_admin');
  await tenant.goto('/storage');
  await expect(tenant.getByRole('heading', { name: 'Storage is temporarily unavailable.' })).toBeVisible();
  await tenant.goto('/compute');
  await expect(tenant.getByRole('heading', { level: 1, name: 'Compute' })).toBeVisible();
  await expect(tenant.getByRole('rowheader', { name: 'web-01', exact: true })).toBeVisible();
});

test('AC-SHL-4.4: once storage is back, Retry loads it without a full page reload (E2E-6)', async ({ page }) => {
  await signIn(page, 'tenant_admin');
  await page.route(STORAGE, (route) => route.fulfill({ status: 503 }));
  await page.goto('/storage');
  await expect(page.getByRole('heading', { name: 'Storage is temporarily unavailable.' })).toBeVisible();
  let reloads = 0;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) reloads++;
  });
  await page.unroute(STORAGE);
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Storage' })).toBeVisible();
  expect(reloads).toBe(0);
});

const CRASHES: { remote: string; area: string; path: string; role: Role }[] = [
  { remote: 'tenants', area: 'Tenants', path: '/tenants/__crash', role: 'provider_admin' },
  { remote: 'storage', area: 'Storage', path: '/storage/__crash', role: 'tenant_admin' },
  { remote: 'compute', area: 'Compute', path: '/compute/__crash', role: 'tenant_admin' },
];

for (const { remote, area, path, role } of CRASHES) {
  test(`AC-SHL-4.3: a render error in ${remote} shows its panel and logs one entry naming it`, async ({ page }) => {
    await signIn(page, role);
    const log = crashLog(page);
    await page.goto(path);
    await expect(page.getByRole('heading', { name: `${area} is temporarily unavailable.` })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await expect.poll(() => log.length).toBe(1);
    expect(await log[0]).toMatchObject({ remote });
    // Leaving the broken route and coming back mounts the area fresh.
    await page.goto(path.replace('/__crash', ''));
    await expect(page.getByRole('heading', { level: 1, name: area })).toBeVisible();
    expect(log).toHaveLength(1);
  });
}

test('AC-SHL-4.6: Back and Forward between /compute and /compute/vm_01 update the compute view', async ({ page }) => {
  await signIn(page, 'tenant_admin');
  await page.goto('/compute/vm_01');
  const drawer = page.getByRole('dialog', { name: 'web-01' });
  await expect(drawer).toBeVisible();
  await drawer.getByRole('button', { name: 'Close' }).click(); // pushes /compute through ctx.navigate
  await expect(page).toHaveURL(/\/compute$/);
  let loads = 0;
  page.on('load', () => loads++);
  await page.goBack();
  await expect(drawer).toBeVisible();
  await expect(page).toHaveURL(/\/compute\/vm_01$/);
  await page.goForward();
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(/\/compute$/);
  await expect(page.getByRole('rowheader', { name: 'web-01', exact: true })).toBeVisible();
  expect(loads).toBe(0); // history moves within the app, not page loads
});
