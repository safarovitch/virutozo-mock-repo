// Shared e2e helpers. Sign-in goes through the real login page, so every test also exercises it.
import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export type Role = 'provider_admin' | 'reseller_admin' | 'tenant_admin' | 'tenant_viewer';
export const ROLE_LABEL: Record<Role, string> = {
  provider_admin: 'Provider admin',
  reseller_admin: 'Reseller admin',
  tenant_admin: 'Tenant admin',
  tenant_viewer: 'Tenant viewer',
};

/** Signs in on /login (optionally with a `returnTo` already in the URL) and waits for the signed-in layout. */
export async function signIn(page: Page, role: Role, loginPath = '/login') {
  await page.goto(loginPath);
  await page.getByRole('radio', { name: ROLE_LABEL[role] }).check();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
}

/** Expires the current session on the server (mock-api test endpoint, AC-SHL-1.4); the browser sends the cookie. */
export async function expireSession(page: Page) {
  const status = await page.evaluate(async () => (await fetch('/api/__test/expire-session', { method: 'POST' })).status);
  expect(status).toBe(204);
}

/** NFR-A11Y-1: no serious or critical axe violations on the current page. */
export async function expectNoA11yViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}
