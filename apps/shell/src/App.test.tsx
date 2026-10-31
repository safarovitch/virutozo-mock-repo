// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import type { Permission, Role } from '@nimbus/api-client/model';
import { createRootBus, type SessionSnapshot } from '@nimbus/mf-contract';
import { ToastProvider } from '@nimbus/ui-kit';
import { App } from './App';
import type { SessionState, SessionStore } from './session';

// Remote loading is covered by the e2e smoke tests; here a remote is a placeholder.
vi.mock('./RemoteHost', () => ({ RemoteHost: ({ name }: { name: string }) => <p>remote:{name}</p> }));

afterEach(cleanup);

const PERMISSIONS: Record<Role, Permission[]> = {
  provider_admin: ['tenant:read', 'vm:read', 'bucket:read', 'quota:read', 'task:read', 'plan:read'],
  reseller_admin: ['tenant:read', 'vm:read', 'bucket:read', 'quota:read', 'task:read', 'plan:read'],
  tenant_admin: ['vm:read', 'vm:operate', 'bucket:read', 'quota:read', 'task:read'],
  tenant_viewer: ['vm:read', 'bucket:read', 'quota:read', 'task:read'],
};
const session = (role: Role): SessionSnapshot => ({ user: { id: 'u_1', name: 'Pat Example', email: 'pat@example.test' }, role, tenant: null, permissions: PERMISSIONS[role] });
const signedIn = (role: Role): SessionState => ({ status: 'signedIn', session: session(role), bus: createRootBus() });

function fakeStore(state: SessionState): SessionStore {
  return { getState: () => state, subscribe: () => () => undefined, boot: vi.fn(), signIn: vi.fn(), signOut: vi.fn(async () => undefined), expire: vi.fn() };
}

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname + l.search}</output>;
}

function renderAt(url: string, store: SessionStore) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ToastProvider>
        <App manifest={{ tenants: '/t.js', storage: '/s.js', compute: '/c.js' }} store={store} />
        <Where />
      </ToastProvider>
    </MemoryRouter>,
  );
}
const where = () => screen.getByTestId('where').textContent;

describe('shell routing', () => {
  it('AC-SHL-3.3: nothing protected renders while /me is pending', () => {
    renderAt('/tenants', fakeStore({ status: 'booting' }));
    expect(screen.getByRole('status', { name: 'Loading…' })).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByText(/remote:/)).toBeNull();
  });

  it('AC-SHL-2.1: a tenant_admin sees Compute and Storage in the sidebar, not Tenants', () => {
    renderAt('/compute', fakeStore(signedIn('tenant_admin')));
    const links = screen.getAllByRole('link').map((a) => a.textContent);
    expect(links).toEqual(['Compute', 'Storage']);
  });

  it('AC-SHL-2.3: sidebar items are links in Tenants → Compute → Storage order; the current one has aria-current="page"', () => {
    renderAt('/compute', fakeStore(signedIn('provider_admin')));
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const links = [...nav.querySelectorAll('a')];
    expect(links.map((a) => a.textContent)).toEqual(['Tenants', 'Compute', 'Storage']);
    expect(links.find((a) => a.textContent === 'Compute')?.getAttribute('aria-current')).toBe('page');
    expect(links.find((a) => a.textContent === 'Tenants')?.getAttribute('aria-current')).toBeNull();
  });

  it('AC-SHL-3.1: a user without tenant:read on /tenants sees the 403 page with a link to their home area', () => {
    renderAt('/tenants', fakeStore(signedIn('tenant_viewer')));
    expect(screen.getByRole('heading', { name: '403 – No access' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Go to Compute' }).getAttribute('href')).toBe('/compute');
    expect(screen.queryByText('remote:tenants')).toBeNull();
  });

  it('AC-SHL-1.5: a tenant role opening / is redirected to /compute', () => {
    renderAt('/', fakeStore(signedIn('tenant_admin')));
    expect(where()).toBe('/compute');
    expect(screen.getByText('remote:compute')).toBeTruthy();
  });

  it('AC-SHL-1.2: a provider_admin opening / is redirected to /tenants', () => {
    renderAt('/', fakeStore(signedIn('provider_admin')));
    expect(where()).toBe('/tenants');
  });

  it('AC-SHL-1.7: a signed-out visit keeps the requested path and query in returnTo', () => {
    renderAt('/tenants/t_acme?status=active', fakeStore({ status: 'signedOut' }));
    expect(where()).toBe('/login?returnTo=%2Ftenants%2Ft_acme%3Fstatus%3Dactive');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  });

  it('AC-SHL-1.7: after sign-in the user lands on returnTo', () => {
    renderAt('/login?returnTo=%2Ftenants%2Ft_acme%3Fstatus%3Dactive', fakeStore(signedIn('provider_admin')));
    expect(where()).toBe('/tenants/t_acme?status=active');
  });

  it('AC-SHL-1.3: after sign-out the router goes to /login without a returnTo', () => {
    renderAt('/compute', fakeStore({ status: 'signedOut', redirect: '/login' }));
    expect(where()).toBe('/login');
  });

  it('AC-SHL-1.4: after expiry the router goes to the expiry URL from the store', () => {
    renderAt('/compute?x=1', fakeStore({ status: 'signedOut', redirect: '/login?reason=expired&returnTo=%2Fcompute%3Fx%3D1' }));
    expect(where()).toBe('/login?reason=expired&returnTo=%2Fcompute%3Fx%3D1');
    expect(within(screen.getByRole('main')).getByRole('alert').textContent).toBe('Your session expired. Please sign in again.');
  });

  it('AC-SHL-1.8: a foreign returnTo is rejected and the user lands on the home area', () => {
    for (const bad of ['//evil.example', 'https://evil.example/x', 'javascript:alert(1)']) {
      renderAt(`/login?returnTo=${encodeURIComponent(bad)}`, fakeStore(signedIn('provider_admin')));
      expect(where(), bad).toBe('/tenants');
      cleanup();
    }
  });

  it('AC-SHL-1.4: /login?reason=expired shows the expiry message', () => {
    renderAt('/login?reason=expired&returnTo=%2Fcompute', fakeStore({ status: 'signedOut' }));
    // Scoped to the page: the toast region keeps an empty role="alert" live region on every page.
    expect(within(screen.getByRole('main')).getByRole('alert').textContent).toBe('Your session expired. Please sign in again.');
  });

  it('AC-SHL-1.1: the login page offers the four demo roles and signs in with the chosen one', async () => {
    const store = fakeStore({ status: 'signedOut' });
    renderAt('/login', store);
    const roles = screen.getAllByRole('radio').map((r) => r.parentElement?.textContent);
    expect(roles).toEqual(['Provider admin', 'Reseller admin', 'Tenant admin', 'Tenant viewer']);
    await userEvent.click(screen.getByRole('radio', { name: 'Tenant viewer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(store.signIn).toHaveBeenCalledWith('tenant_viewer');
  });

  it('AC-SHL-1.3: the user menu shows the name and role and signs out', async () => {
    const store = fakeStore(signedIn('tenant_admin'));
    renderAt('/compute', store);
    const toggle = screen.getByRole('button', { name: 'Account: Pat Example' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Tenant admin')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(store.signOut).toHaveBeenCalledTimes(1);
  });

  it('RBAC-5: an unknown path shows the not-found page inside the layout', () => {
    renderAt('/nope', fakeStore(signedIn('tenant_admin')));
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy();
  });
});
