// SPEC-SHL-7 (E2E-9): two pages in one browser context share the session cookie. Signing out ends the
// shared session that other tests' contexts don't use, but it runs exclusive to keep server-side session
// counts and sockets out of the parallel suite (D8-18).
import { expect, test } from '@playwright/test';
import { ROLE_LABEL, expireSession, signIn } from './support';

test('AC-SHL-7.1: signing out in tab A sends tab B to /login within 1 s, without user action (E2E-9)', async ({ page, context }) => {
  await signIn(page, 'tenant_admin');
  const b = await context.newPage();
  await b.goto('/storage');
  await expect(b.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await page.getByRole('button', { name: /^Account: / }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(b).toHaveURL(/\/login$/, { timeout: 1_000 });
});

test('AC-SHL-7.2: signing in as a different role in tab A reloads tab B with that role\'s areas; AC-SHL-7.4: a /login tab follows (E2E-9)', async ({ page, context }) => {
  await signIn(page, 'tenant_admin');
  const b = await context.newPage();
  await b.goto('/compute');
  await expect(b.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Compute' })).toBeVisible(); // B has booted
  await expect(b.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Tenants' })).toHaveCount(0);
  await page.getByRole('button', { name: /^Account: / }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(b).toHaveURL(/\/login$/); // B is on /login now (D8-02)

  await page.getByRole('radio', { name: ROLE_LABEL.provider_admin }).check();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(b.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Tenants' })).toBeVisible({ timeout: 5_000 });
  await expect(b).toHaveURL(/\/tenants/); // another user: B goes to the new user's home, not B's old page
});

test('AC-SHL-7.3: an expiry seen in tab A shows errors.UNAUTHENTICATED in tab B (E2E-9)', async ({ page, context }) => {
  await signIn(page, 'tenant_admin');
  await expect(page.getByRole('table', { name: 'Virtual machines' })).toBeVisible();
  const b = await context.newPage();
  await b.goto('/storage');
  await expect(b.getByRole('table', { name: 'Buckets' })).toBeVisible();
  await expireSession(page); // the server closes both sockets with 4401; whichever tab hears first tells the other
  await expect(b.getByText('Your session expired. Please sign in again.')).toBeVisible({ timeout: 5_000 });
  await expect(b).toHaveURL(/\/login\?reason=expired&returnTo=%2Fstorage/);
});
