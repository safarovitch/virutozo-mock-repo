// Shared e2e helpers. Sign-in goes through the real login page, so every test also exercises it.
import { expect, type APIRequestContext, type Page } from '@playwright/test';
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

/** Calls the API from the page, with the session cookie and the CSRF header (D6-16: test setup only). */
export async function api<T = unknown>(page: Page, method: string, path: string, body?: unknown): Promise<{ status: number; body: T }> {
  return page.evaluate(
    async ({ method, path, body }) => {
      const res = await fetch(`/api${path}`, {
        method,
        headers: { 'X-Nimbus-Csrf': '1', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
    },
    { method, path, body },
  );
}

interface VmRow {
  id: string;
  name: string;
  status: string;
  activeTaskId: string | null;
}

/**
 * D6-16: each VM-mutating test owns one VM. This waits for any earlier operation on it to end, starts it
 * when it's stopped, and returns once it's `running` with no active task. Needs a tenant_admin session.
 */
export async function ensureRunning(page: Page, name: string): Promise<VmRow> {
  const find = async () => (await api<{ items: VmRow[] }>(page, 'GET', '/vms?limit=200')).body.items.find((vm) => vm.name === name) as VmRow;
  await expect.poll(async () => (await find()).activeTaskId, { timeout: 15_000 }).toBeNull();
  const vm = await find();
  if (vm.status === 'stopped') expect((await api(page, 'POST', `/vms/${vm.id}/actions`, { action: 'start' })).status).toBe(202);
  await expect.poll(async () => { const v = await find(); return `${v.status}:${v.activeTaskId}`; }, { timeout: 15_000 }).toBe('running:null');
  return find();
}

/**
 * A6-05: the `exclusive` project leaves the seed as it found it (VM states, acme's status, the task list),
 * so a reused server gives the same results on the next run. Safe only there: nothing else runs then.
 */
export async function resetSeed(request: APIRequestContext) {
  expect((await request.post('/api/__test/reset')).status()).toBe(204);
}
