// SPEC-SHL-1 (sign-in and session), SPEC-SHL-2 (navigation), SPEC-SHL-3 (permissions), against the gateway.
import { expect, test } from '@playwright/test';
import { expectNoA11yViolations, expireSession, signIn } from './support';

test('AC-SHL-1.1: a tenant_viewer signs in and lands on /compute', async ({ page }) => {
  await signIn(page, 'tenant_viewer');
  await expect(page).toHaveURL(/\/compute$/);
  await expect(page.getByRole('heading', { name: 'Compute' })).toBeVisible();
});

test('AC-SHL-1.2: a provider_admin signs in and lands on /tenants', async ({ page }) => {
  await signIn(page, 'provider_admin');
  await expect(page).toHaveURL(/\/tenants$/);
  await expect(page.getByRole('heading', { name: 'Tenants' })).toBeVisible();
});

test('AC-SHL-1.5: a signed-in tenant role opening / is redirected to /compute', async ({ page }) => {
  await signIn(page, 'tenant_admin');
  await page.goto('/');
  await expect(page).toHaveURL(/\/compute$/);
});

test('AC-SHL-1.6: reloading keeps the session and the URL, without visiting /login', async ({ page }) => {
  await signIn(page, 'provider_admin');
  const visited: string[] = [];
  page.on('framenavigated', (f) => visited.push(new URL(f.url()).pathname));
  await page.goto('/tenants/t_acme?status=active');
  await page.reload();
  await expect(page).toHaveURL(/\/tenants\/t_acme\?status=active$/);
  await expect(page.getByRole('heading', { name: 'Tenants' })).toBeVisible();
  expect(visited).not.toContain('/login');
});

test('AC-SHL-1.6: a tenant_admin reloading /compute stays signed in', async ({ page }) => {
  await signIn(page, 'tenant_admin');
  await page.reload();
  await expect(page).toHaveURL(/\/compute$/);
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
});

test('AC-SHL-1.7: a signed-out deep link survives sign-in', async ({ page }) => {
  await page.goto('/tenants/t_acme?status=active');
  await expect(page).toHaveURL(/\/login\?returnTo=%2Ftenants%2Ft_acme%3Fstatus%3Dactive$/);
  await page.getByRole('radio', { name: 'Provider admin' }).check();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/tenants\/t_acme\?status=active$/);
});

test('AC-SHL-1.8: returnTo is followed only on the app origin', async ({ page, baseURL }) => {
  const cases: [string, string][] = [
    ['/tenants?status=active', '/tenants?status=active'],
    ['//evil.example', '/tenants'],
    ['/\\evil.example', '/tenants'],
    ['https://evil.example/x', '/tenants'],
    ['javascript:alert(1)', '/tenants'],
    ['/%2F%2Fevil.example', '/%2F%2Fevil.example'],
  ];
  for (const [input, landing] of cases) {
    await page.context().clearCookies();
    await signIn(page, 'provider_admin', `/login?returnTo=${encodeURIComponent(input)}`);
    await expect.poll(() => new URL(page.url()).origin, { message: input }).toBe(new URL(baseURL as string).origin);
    await expect.poll(() => { const u = new URL(page.url()); return u.pathname + u.search; }, { message: input }).toBe(landing);
  }
});

test('AC-SHL-1.9: the session cookie is httpOnly, Secure, SameSite=Strict on /api, and never in web storage', async ({ page, context }) => {
  await signIn(page, 'tenant_admin');
  const cookie = (await context.cookies()).find((c) => c.name === 'nimbus_session');
  expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Strict', path: '/api' });
  const stored = await page.evaluate(() => [localStorage, sessionStorage].flatMap((s) => Object.keys(s).map((k) => s.getItem(k))));
  expect(stored).not.toContain(cookie?.value);
});

test('AC-SHL-1.3: sign-out lands on /login and Back stays there', async ({ page }) => {
  await signIn(page, 'tenant_admin');
  // A signed-in page in the history, so Back has somewhere in the app to go.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Storage' }).click();
  await expect(page).toHaveURL(/\/storage$/);
  await page.getByRole('button', { name: /^Account: / }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});

test('AC-SHL-1.12: signing out after the session expired lands on /login with no error', async ({ page }) => {
  // Since Day 4 the server closes the socket with 4401 as soon as expire-session runs, and the client
  // redirects on it (AC-SHL-6.6). This AC is about the window before the client hears of the expiry
  // (the server checks TTL expiry only every 15 s), so the close is held back from the page (D4-16).
  await page.routeWebSocket('/api/events', (ws) => {
    const server = ws.connectToServer();
    server.onClose(() => {});
  });
  await signIn(page, 'tenant_admin');
  // A6-06: since Day 6 Compute loads data on /compute; let it finish, so no request of its own gets the 401.
  await expect(page.getByRole('table', { name: 'Virtual machines' })).toBeVisible();
  await expireSession(page);
  await page.getByRole('button', { name: /^Account: / }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Your session expired. Please sign in again.')).toHaveCount(0);
});

test('AC-SHL-1.13: reloading a tenant drawer URL through the gateway keeps the URL and the session', async ({ page }) => {
  await signIn(page, 'provider_admin');
  await page.goto('/tenants/t_acme?tab=quotas');
  await page.reload();
  await expect(page).toHaveURL(/\/tenants\/t_acme\?tab=quotas$/);
  await expect(page.getByRole('heading', { name: 'Tenants' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('tab', { name: 'Quotas' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('dialog').getByRole('spinbutton', { name: 'Storage quota (GiB)' })).toBeVisible();
});

test('AC-SHL-2.1: a tenant_admin sees Compute and Storage in the sidebar, not Tenants', async ({ page }) => {
  await signIn(page, 'tenant_admin');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link')).toHaveText(['Compute', 'Storage']);
});

test('AC-SHL-2.3: sidebar items work by keyboard and mark the current page', async ({ page }) => {
  await signIn(page, 'provider_admin');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await nav.getByRole('link', { name: 'Tenants' }).focus();
  await page.keyboard.press('Tab');
  await expect(nav.getByRole('link', { name: 'Compute' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/compute$/);
  await expect(nav.getByRole('link', { name: 'Compute' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Tenants' })).not.toHaveAttribute('aria-current', 'page');
});

test('AC-SHL-3.1: without tenant:read, /tenants shows the 403 page with a link home', async ({ page }) => {
  await signIn(page, 'tenant_viewer');
  await page.goto('/tenants');
  await expect(page.getByRole('heading', { name: '403 – No access' })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole('link', { name: 'Go to Compute' }).click();
  await expect(page).toHaveURL(/\/compute$/);
});

test('NFR-A11Y-1: the login page and the signed-in layout have no serious axe violations', async ({ page }) => {
  await page.goto('/login?reason=expired');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expectNoA11yViolations(page);
  await signIn(page, 'provider_admin');
  await expect(page.getByRole('heading', { name: 'Tenants' })).toBeVisible();
  await page.getByRole('button', { name: /^Account: / }).click();
  await expectNoA11yViolations(page);
});
