// SPEC-SHL-5 real-user monitoring through the gateway: the shell's beacon. `/_vitals` with seeded
// records is in rum.exclusive.spec.ts (it needs a fresh reportVitals rate window, A9-04).
import { expect, test } from '@playwright/test';
import { signIn } from './support';

interface Sent {
  metric: string;
  route: string;
  remote: string;
}

test('AC-SHL-5.1: the metrics are sent once, on visibilitychange: hidden; AC-SHL-5.2: each record is complete and uses the route template', async ({ page }) => {
  await signIn(page, 'provider_admin');
  await page.goto('/tenants/t_acme');
  await expect(page.getByRole('dialog', { name: /Acme Corporation/ })).toBeVisible();
  // A beacon's Blob body is only readable while the request is intercepted (postData() is null otherwise).
  const sent: string[] = [];
  await page.route('**/api/rum', async (route) => {
    sent.push(route.request().postDataBuffer()?.toString() ?? '');
    await route.continue();
  });
  // Only this page's beacons: the previous page's own beacon can arrive after the navigation.
  const beacons = () => sent.filter((body) => body.includes('/tenants/:tenantId'));
  const hide = () =>
    page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
  await expect.poll(async () => { await hide(); return beacons().length; }, { timeout: 10_000 }).toBe(1);
  await hide();
  await hide();
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect.poll(() => beacons().length).toBe(1);
  const body = beacons()[0] ?? '[]';
  const records = JSON.parse(body) as Sent[];
  const lcp = records.find((r) => r.metric === 'LCP');
  expect(lcp).toMatchObject({ metric: 'LCP', value: expect.any(Number), rating: expect.stringMatching(/^(good|needs-improvement|poor)$/), route: '/tenants/:tenantId', remote: 'tenants', navigationType: expect.any(String), ts: expect.any(String) });
  expect(new Set(records.map((r) => r.metric)).size).toBe(records.length); // each metric at most once
  expect(body).not.toContain('t_acme'); // D9-04: no IDs
});
