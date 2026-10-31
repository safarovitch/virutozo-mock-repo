import { expect, test } from '@playwright/test';

const AREAS = [
  { name: 'tenants', title: 'Tenants' },
  { name: 'storage', title: 'Storage' },
  { name: 'compute', title: 'Compute' },
] as const;

test('TECH-1: shell loads and shows navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/tenants$/);
  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const area of AREAS) {
    await expect(nav.getByRole('link', { name: area.title })).toBeVisible();
  }
  await expect(nav.getByRole('link', { name: 'Tenants' })).toHaveAttribute('aria-current', 'page');
});

test('TECH-1: each remote mounts from its /remotes/<name>/ path', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (r) => requested.push(new URL(r.url()).pathname));

  for (const area of AREAS) {
    await page.goto(`/${area.name}`);
    await expect(page.getByRole('heading', { name: area.title })).toBeVisible();
    expect(requested).toContain(`/remotes/${area.name}/remoteEntry.js`);
  }

  // React and React DOM are shared singletons (MF-2): the React remotes use the shell's copy,
  // so their own bundled fallback chunks are never fetched.
  const remoteReactChunks = requested.filter((p) => /^\/remotes\/(tenants|storage)\/.*react/.test(p));
  expect(remoteReactChunks).toEqual([]);
});

test('TECH-1: a failing remote shows the error panel and the rest of the shell still works', async ({ page }) => {
  await page.route('**/remotes/storage/**', (route) => route.fulfill({ status: 503, body: 'down' }));

  await page.goto('/storage');
  const panel = page.getByRole('alert');
  await expect(panel.getByRole('heading', { name: 'Storage is temporarily unavailable.' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Retry' })).toBeVisible();

  // The sidebar still works and the other areas load.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Compute' }).click();
  await expect(page.getByRole('heading', { name: 'Compute' })).toBeVisible();

  // When storage is back, Retry loads it without a full page reload.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Storage' }).click();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await page.unroute('**/remotes/storage/**');
  const navigations: string[] = [];
  page.on('framenavigated', (f) => navigations.push(f.url()));
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('heading', { name: 'Storage' })).toBeVisible();
  expect(navigations).toEqual([]);
});
