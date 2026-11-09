// SPEC-SHL-5: the RUM collector with fake web-vitals callbacks and a fake document (no browser needed).
import { describe, expect, it, vi } from 'vitest';
import type { VitalRecord } from '@nimbus/api-client/model';
import { remoteFor, routeTemplate, startRum, type RumDeps, type VitalMetric } from './rum';

function setup(overrides: Partial<RumDeps> = {}) {
  const reporters: Partial<Record<VitalMetric['name'], (m: VitalMetric) => void>> = {};
  const listeners: Record<string, (() => void)[]> = {};
  let path = '/tenants/t_acme';
  const target = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (type: string, fn: () => void) => void (listeners[type] ??= []).push(fn),
  };
  const sent: { url: string; records: VitalRecord[] }[] = [];
  const deps = {
    onLCP: (fn: (m: VitalMetric) => void) => void (reporters.LCP = fn),
    onINP: (fn: (m: VitalMetric) => void) => void (reporters.INP = fn),
    onCLS: (fn: (m: VitalMetric) => void) => void (reporters.CLS = fn),
    pathname: () => path,
    sendBeacon: vi.fn((url: string, data: Blob) => {
      void data.text().then((text) => sent.push({ url, records: JSON.parse(text) as VitalRecord[] }));
      return true;
    }),
    report: vi.fn(async () => undefined),
    now: () => new Date('2026-11-06T12:00:00.000Z'),
    target,
    ...overrides,
  } satisfies RumDeps;
  startRum(deps);
  const metric = (name: VitalMetric['name'], value: number, rating: VitalMetric['rating'] = 'good') => reporters[name]?.({ name, value, rating, navigationType: 'navigate' });
  const hide = () => {
    target.visibilityState = 'hidden';
    for (const fn of listeners.visibilitychange ?? []) fn();
  };
  const fire = (type: string) => (listeners[type] ?? []).forEach((fn) => fn());
  return { deps, metric, hide, fire, sent, navigate: (to: string) => (path = to) };
}

const flushBlobs = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('SPEC-SHL-5 real-user monitoring', () => {
  it('AC-SHL-5.1: each metric is sent at most once per page load, flushed on visibilitychange: hidden', async () => {
    const s = setup();
    s.metric('LCP', 1200);
    s.metric('CLS', 0.02);
    s.metric('CLS', 0.05); // a later value replaces the earlier one
    s.metric('INP', 80);
    expect(s.deps.sendBeacon).not.toHaveBeenCalled(); // nothing before the page is hidden
    s.hide();
    s.hide();
    s.fire('pagehide');
    s.metric('INP', 400);
    s.hide();
    await flushBlobs();
    expect(s.deps.sendBeacon).toHaveBeenCalledOnce();
    expect(s.sent[0]?.url).toBe('/api/rum');
    expect(s.sent[0]?.records.map((r) => [r.metric, r.value])).toEqual([['LCP', 1200], ['CLS', 0.05], ['INP', 80]]);
  });

  it('AC-SHL-5.1: pagehide flushes too; nothing is sent when no metric arrived', async () => {
    const empty = setup();
    empty.fire('pagehide');
    expect(empty.deps.sendBeacon).not.toHaveBeenCalled();
    const s = setup();
    s.metric('LCP', 900);
    s.fire('pagehide');
    await flushBlobs();
    expect(s.sent).toHaveLength(1);
  });

  it('AC-SHL-5.2: every record has metric, value, rating, route, remote, navigationType (and ts); routes are templates', async () => {
    const s = setup();
    s.metric('LCP', 2600, 'needs-improvement');
    s.navigate('/compute/vm_01?tenantId=t_8f2k1');
    s.metric('INP', 90);
    s.hide();
    await flushBlobs();
    expect(s.sent[0]?.records).toEqual([
      { metric: 'LCP', value: 2600, rating: 'needs-improvement', route: '/tenants/:tenantId', remote: 'tenants', navigationType: 'navigate', ts: '2026-11-06T12:00:00.000Z' },
      { metric: 'INP', value: 90, rating: 'good', route: '/compute/:vmId', remote: 'compute', navigationType: 'navigate', ts: '2026-11-06T12:00:00.000Z' },
    ]);
    expect(JSON.stringify(s.sent)).not.toMatch(/t_acme|vm_01|t_8f2k1/); // D9-04: no IDs leave the page
  });

  it('AC-SHL-5.2: if sendBeacon refuses, the records go through reportVitals once; failures are ignored', async () => {
    const report = vi.fn<(records: VitalRecord[]) => Promise<unknown>>(async () => Promise.reject(new Error('offline')));
    const s = setup({ sendBeacon: vi.fn(() => false), report });
    s.metric('CLS', 0.3, 'poor');
    s.hide();
    await flushBlobs();
    expect(report).toHaveBeenCalledOnce();
    expect(report.mock.calls[0]?.[0]).toMatchObject([{ metric: 'CLS', rating: 'poor', route: '/tenants/:tenantId' }]);
  });

  it('AC-SHL-5.2: route templates and remotes for every kind of path', () => {
    expect(['/', '/login', '/_vitals', '/tenants', '/tenants/t_acme', '/storage', '/storage/x', '/compute/vm_01', '/nope/t_acme'].map(routeTemplate)).toEqual([
      '/', '/login', '/_vitals', '/tenants', '/tenants/:tenantId', '/storage', '/storage/:id', '/compute/:vmId', '/*',
    ]);
    expect(['/tenants/t_acme', '/storage', '/login', '/'].map(remoteFor)).toEqual(['tenants', 'storage', 'shell', 'shell']);
  });
});
