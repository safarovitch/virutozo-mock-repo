// SPEC-SHL-5 `/_vitals` with seeded records. Every closed e2e page sends a beacon from the same client IP,
// so the parallel suite keeps reportVitals at its rate limit (60/min). This runs in the `exclusive`
// project and starts with a reset, which also clears the rate windows (A9-04).
import { expect, test } from '@playwright/test';
import { resetSeed, signIn } from './support';

test.beforeAll(async ({ request }) => resetSeed(request));
test.afterAll(async ({ request }) => resetSeed(request));

test('AC-SHL-5.3: /_vitals shows p75 per route for seeded records; other roles get the 403 page', async ({ page, request, baseURL }) => {
  const route = `/e2e-${Date.now()}`;
  const ts = new Date().toISOString();
  const record = (value: number) => ({ metric: 'INP', value, rating: 'good', route, remote: 'shell', navigationType: 'navigate', ts });
  expect((await request.post('/api/rum', { headers: { origin: baseURL as string }, data: [100, 150, 220, 600].map(record) })).status()).toBe(204);

  await signIn(page, 'provider_admin');
  await page.goto('/_vitals');
  const row = page.getByRole('table', { name: 'Web Vitals' }).getByRole('row').filter({ has: page.getByRole('rowheader', { name: route, exact: true }) });
  await expect(row).toContainText('INP');
  await expect(row).toContainText('220 ms'); // p75 of 100, 150, 220, 600
  await expect(row).toContainText('Needs improvement'); // web-vitals INP thresholds: 200 / 500 ms
  await expect(row).toContainText('4');
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: /Vitals/ })).toHaveCount(0); // not in the sidebar

  await page.getByRole('button', { name: /^Account: / }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await signIn(page, 'reseller_admin');
  await page.goto('/_vitals');
  await expect(page.getByRole('heading', { name: '403 – No access' })).toBeVisible();
});
