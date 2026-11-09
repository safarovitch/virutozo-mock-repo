// SPEC-CMP-2 / SPEC-CMP-5 journeys that run real VM tasks on acme. Every acme session sees those tasks
// (task center counts, getTask fetches), so they run in the `exclusive` project after the parallel suite
// (D6-16, A6-05). Each test still owns its VM: worker-03 and worker-06.
import { expect, test, type Page } from '@playwright/test';
import { api, ensureRunning, resetSeed, signIn } from './support';

test.afterAll(async ({ request }) => resetSeed(request)); // A6-05

const table = (page: Page) => page.getByRole('table', { name: 'Virtual machines' });
const row = (page: Page, name: string) => table(page).getByRole('row').filter({ has: page.getByRole('rowheader', { name, exact: true }) });

test('AC-CMP-2.1: Reboot shows rebooting at once and live progress until the VM runs again (E2E-4, AC-CMP-5.3)', async ({ page }) => {
  await signIn(page, 'tenant_admin');
  const vm = await ensureRunning(page, 'worker-03');
  await page.goto(`/compute/${vm.id}`);
  const drawer = page.getByRole('dialog', { name: 'worker-03' });
  await drawer.getByRole('button', { name: 'Reboot' }).click();
  await expect(drawer.getByText('Rebooting')).toBeVisible();
  const bar = drawer.getByRole('progressbar', { name: 'Reboot VM: worker-03' });
  await expect(bar).toHaveAttribute('aria-valuenow', /\d+/);
  const first = Number(await bar.getAttribute('aria-valuenow'));
  await expect.poll(async () => Number(await bar.getAttribute('aria-valuenow')), { timeout: 8_000 }).toBeGreaterThan(first); // AC-CMP-5.3
  await expect(drawer.getByRole('button', { name: 'Reboot' })).toHaveAttribute('aria-disabled', 'true'); // AC-CMP-2.4
  await expect(page.getByText('worker-03 rebooted.')).toBeVisible({ timeout: 12_000 });
  await expect(drawer.getByText('Running')).toBeVisible();
  await expect(page.getByRole('button', { name: /Tasks/ })).toBeVisible(); // the task center got task:started too
});

test('AC-CMP-1.5: opening Compute while a VM has an active task shows its progress', async ({ page }) => {
  await signIn(page, 'tenant_admin');
  const vm = await ensureRunning(page, 'worker-06');
  expect((await api(page, 'POST', `/vms/${vm.id}/actions`, { action: 'reboot' })).status).toBe(202);
  const taskRequests: string[] = [];
  page.on('request', (r) => {
    if (/\/api\/tasks\/[^/?]+$/.test(new URL(r.url()).pathname)) taskRequests.push(r.url());
  });
  await page.goto('/compute');
  await expect(row(page, 'worker-06')).toContainText(/Rebooting\s*\d+%/);
  expect(taskRequests).toHaveLength(1);
});
