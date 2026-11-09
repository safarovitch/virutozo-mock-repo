// SPEC-SHL-6 (realtime connection) and SPEC-TSK-1 (task center), against the gateway.
import { expect, test, type Page, type WebSocket } from '@playwright/test';
import { expectNoA11yViolations, expireSession, signIn } from './support';

const isEvents = (ws: WebSocket) => new URL(ws.url()).pathname === '/api/events';
const connection = (page: Page) => page.getByRole('status', { name: 'Connection' });

/** POST to a mock-api test endpoint as the signed-in user (the browser sends the cookie). */
async function testEndpoint(page: Page, path: string, body?: unknown) {
  const status = await page.evaluate(
    async ([p, b]) =>
      (await fetch(`/api/__test/${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: b === undefined ? undefined : JSON.stringify(b) })).status,
    [path, body] as const,
  );
  expect(status).toBe(204);
}

const runningTask = (id: string, vm: string, name: string) => ({
  type: 'task.updated',
  task: {
    id,
    kind: 'vm.reboot',
    status: 'running',
    progress: 30,
    seq: 1,
    resource: { type: 'vm', id: vm, name },
    tenantId: 't_acme',
    error: null,
    createdAt: new Date().toISOString(),
    finishedAt: null,
  },
});

test('AC-SHL-6.1: one WebSocket for a whole session across /tenants, /compute and /storage', async ({ page }) => {
  const sockets: WebSocket[] = [];
  page.on('websocket', (ws) => {
    if (isEvents(ws)) sockets.push(ws);
  });
  await signIn(page, 'provider_admin');
  await expect(connection(page)).toHaveText('Connected');
  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const area of ['Compute', 'Storage', 'Tenants']) {
    await nav.getByRole('link', { name: area }).click();
    await expect(page.getByRole('heading', { name: area })).toBeVisible();
  }
  expect(sockets).toHaveLength(1);
  expect(sockets[0]?.isClosed()).toBe(false);
});

test('AC-SHL-6.4: the header connection status shows "Reconnecting…" when the server drops the socket', async ({ page }) => {
  await signIn(page, 'tenant_admin');
  await expect(connection(page)).toHaveText('Connected');
  await testEndpoint(page, 'drop-sockets', { holdMs: 3000 }); // D4-05: refuse reconnects for 3 s
  await expect(connection(page)).toHaveText('Reconnecting…');
  await expect(connection(page)).toHaveText('Connected', { timeout: 15_000 });
});

test('AC-SHL-6.6: on close 4401 the user lands on /login?reason=expired with the expiry message', async ({ page }) => {
  await signIn(page, 'tenant_admin');
  await expect(connection(page)).toHaveText('Connected');
  await expireSession(page); // the server closes the session's sockets with 4401; no HTTP call follows
  await expect(page).toHaveURL(/\/login\?reason=expired&returnTo=%2Fcompute$/);
  await expect(page.getByText('Your session expired. Please sign in again.')).toBeVisible();
});

test('AC-SHL-1.4: an expired session redirects to /login?reason=expired&returnTo=<current path>', async ({ page }) => {
  await signIn(page, 'provider_admin');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Storage' }).click();
  await expect(connection(page)).toHaveText('Connected');
  await expireSession(page);
  await expect(page).toHaveURL(/\/login\?reason=expired&returnTo=%2Fstorage$/);
  await expect(page.getByText('Your session expired. Please sign in again.')).toBeVisible();
});

test('AC-SHL-6.10: reloading /login?reason=expired still shows the expiry message', async ({ page }) => {
  await signIn(page, 'tenant_admin');
  await expect(connection(page)).toHaveText('Connected');
  await expireSession(page);
  await expect(page).toHaveURL(/reason=expired/);
  await page.reload();
  await expect(page.getByText('Your session expired. Please sign in again.')).toBeVisible();
});

test('TECH-4: signing out closes the WebSocket and no new one opens (RT-10, R13)', async ({ page }) => {
  const sockets: WebSocket[] = [];
  page.on('websocket', (ws) => {
    if (isEvents(ws)) sockets.push(ws);
  });
  await signIn(page, 'tenant_admin');
  await expect(connection(page)).toHaveText('Connected');
  const socket = sockets[0] as WebSocket;
  const closed = socket.waitForEvent('close');
  await page.getByRole('button', { name: /^Account: / }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await closed;
  expect(sockets).toHaveLength(1);
});

test('AC-SHL-2.2: with 2 running tasks the task center badge shows "2" and is labelled "2 running tasks"', async ({ page }) => {
  await signIn(page, 'tenant_admin');
  await expect(connection(page)).toHaveText('Connected');
  await testEndpoint(page, 'emit', runningTask('task_e2e_1', 'vm_01', 'web-01'));
  await testEndpoint(page, 'emit', runningTask('task_e2e_2', 'vm_02', 'web-02'));
  const button = page.getByRole('button', { name: 'Tasks, 2 running tasks' });
  await expect(button.getByText('2', { exact: true })).toBeVisible();
  await button.click();
  await expect(page.getByRole('progressbar', { name: 'Reboot VM: web-02' })).toHaveAttribute('aria-valuenow', '30');
  await expectNoA11yViolations(page);
});

test('AC-TSK-1.6: for tenant roles the tenant.provision task shows "acme" as plain text, not a link', async ({ page }) => {
  await signIn(page, 'tenant_viewer');
  await page.getByRole('button', { name: /^Tasks/ }).click();
  const recent = page.getByRole('region', { name: 'Recent' });
  await expect(recent.getByText('Provision tenant')).toBeVisible();
  await expect(recent.getByText('acme', { exact: true })).toBeVisible();
  await expect(recent.getByRole('link', { name: /acme/ })).toHaveCount(0);
  // VM tasks of the same tenant do link (canOpen, AC-TSK-1.3).
  await expect(recent.getByRole('link', { name: 'View resource: db-02' })).toBeVisible();
});
