// @vitest-environment jsdom
// SPEC-SHL-5 `/_vitals`: the page against a stubbed getVitalsSummary, and its permission gate in the router.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Permission, type VitalSummary } from '@nimbus/api-client/model';
import { createRootBus } from '@nimbus/mf-contract';
import { ToastProvider } from '@nimbus/ui-kit';
import { App } from './App';
import type { SessionStore } from './session';
import { VitalsPage, formatP75 } from './VitalsPage';

vi.mock('./TaskCenter', () => ({ TaskCenter: () => null }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const SUMMARY: VitalSummary[] = [
  { route: '/tenants', metric: 'LCP', p75: 1840.4, rating: 'good', samples: 1200 },
  { route: '/tenants', metric: 'CLS', p75: 0.312, rating: 'poor', samples: 9 },
  { route: '/compute/:vmId', metric: 'INP', p75: 260, rating: 'needs-improvement', samples: 3 },
];
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' } });

function renderPage(response: Response) {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <VitalsPage />
    </QueryClientProvider>,
  );
  return fetch;
}

describe('SPEC-SHL-5 /_vitals', () => {
  it('AC-SHL-5.3: shows p75 per route and metric with the rating as text, sorted by route', async () => {
    const fetch = renderPage(json(200, SUMMARY));
    const table = await screen.findByRole('table', { name: 'Web Vitals' });
    const rows = within(table).getAllByRole('row').slice(1).map((r) => r.textContent);
    expect(rows).toEqual(['/compute/:vmIdINP260 msNeeds improvement3', '/tenantsCLS0.31Poor9', '/tenantsLCP1,840 msGood1,200']);
    expect(String(fetch.mock.calls[0]?.[0])).toContain('/api/rum/summary');
  });

  it('AC-SHL-5.3: empty and error states', async () => {
    renderPage(json(200, []));
    expect(await screen.findByRole('heading', { name: 'No measurements in the last 24 hours.' })).toBeTruthy();
    cleanup();
    renderPage(json(500, { title: 'x', status: 500, code: 'INTERNAL' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Something went wrong on our side. Try again.');
  });

  it('AC-SHL-5.3: formats CLS with two decimals and the others in milliseconds', () => {
    expect([formatP75({ metric: 'CLS', p75: 0.1 }), formatP75({ metric: 'LCP', p75: 2500.6 }), formatP75({ metric: 'TTFB', p75: 80 })]).toEqual(['0.10', '2,501 ms', '80 ms']);
  });

  it('RBAC-5: /_vitals without vitals:read shows the 403 page and requests nothing', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    const state = { status: 'signedIn' as const, bus: createRootBus(), session: { user: { id: 'u', name: 'T', email: 't@x.test' }, role: 'tenant_admin' as const, tenant: null, permissions: [Permission['vm:read'], Permission['task:read']] } };
    const store: SessionStore = {
      getState: () => state, // the same object every time (useSyncExternalStore)
      subscribe: () => () => undefined,
      boot: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(async () => undefined),
      expire: vi.fn(),
    };
    render(
      <MemoryRouter initialEntries={['/_vitals']}>
        <ToastProvider>
          <QueryClientProvider client={new QueryClient()}>
            <App manifest={{ tenants: '/t.js', storage: '/s.js', compute: '/c.js' }} store={store} />
          </QueryClientProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: '403 – No access' })).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });
});
