// Real-user monitoring (SPEC-SHL-5, D9-07/08). LCP, INP and CLS from web-vitals; each metric's latest
// value is kept and sent **once per page load**, at the first `visibilitychange: hidden` or `pagehide`,
// in one `sendBeacon` batch. `route` is a template, never the URL (D9-04).
import type { VitalRecord } from '@nimbus/api-client/model';
import { AREAS } from '@nimbus/auth';

type MetricName = 'LCP' | 'INP' | 'CLS';

export interface VitalMetric {
  name: MetricName;
  value: number;
  rating: VitalRecord['rating'];
  navigationType: string;
}

type OnMetric = (report: (metric: VitalMetric) => void, opts: { reportAllChanges: boolean }) => void;

export interface RumDeps {
  onLCP: OnMetric;
  onINP: OnMetric;
  onCLS: OnMetric;
  /** The current path (for the route template). */
  pathname(): string;
  /** `navigator.sendBeacon`; returns false when the browser refused to queue it. */
  sendBeacon?(url: string, data: Blob): boolean;
  /** Fallback: the generated `reportVitals` with `keepalive` (H2, D9-08). */
  report(records: VitalRecord[]): Promise<unknown>;
  now(): Date;
  /** `visibilitychange` from the document, `pagehide` from the window. */
  target: { readonly visibilityState: DocumentVisibilityState; addEventListener(type: 'visibilitychange' | 'pagehide', listener: () => void): void };
}

/** Path segment names for an area's detail pages (url-conventions); other areas use `:id`. */
const DETAIL: Record<string, string> = { tenants: ':tenantId', compute: ':vmId' };
const AREA_NAMES: ReadonlySet<string> = new Set(AREAS.map((a) => a.name));

/** `/tenants/t_acme?q=x` → `/tenants/:tenantId`. Unknown paths collapse to `/*` so no ID ever leaks. */
export function routeTemplate(pathname: string): string {
  const [area, detail] = pathname.split('/').filter(Boolean);
  if (!area) return '/';
  if (AREA_NAMES.has(area)) return detail ? `/${area}/${DETAIL[area] ?? ':id'}` : `/${area}`;
  if (area === 'login' || area === '_vitals') return `/${area}`;
  return '/*';
}

/** The remote that owns a path, or `shell`. */
export function remoteFor(pathname: string): string {
  const area = pathname.split('/').filter(Boolean)[0] ?? '';
  return AREA_NAMES.has(area) ? area : 'shell';
}

/** Starts collecting. Returns the flush function (for tests); it runs at most once. */
export function startRum(deps: RumDeps): () => void {
  const loadedAt = deps.pathname();
  const latest = new Map<MetricName, VitalMetric>();
  let sent = false;

  const keep = (metric: VitalMetric) => latest.set(metric.name, metric);
  // reportAllChanges: the map always holds the newest value, whichever listener runs first on hide.
  deps.onLCP(keep, { reportAllChanges: true });
  deps.onINP(keep, { reportAllChanges: true });
  deps.onCLS(keep, { reportAllChanges: true });

  const flush = () => {
    if (sent || latest.size === 0) return;
    sent = true;
    const ts = deps.now().toISOString();
    const records: VitalRecord[] = [...latest.values()].map((m) => {
      // LCP belongs to the page as loaded; INP and CLS to where the user is when the page goes away.
      const path = m.name === 'LCP' ? loadedAt : deps.pathname();
      return { metric: m.name, value: m.value, rating: m.rating, route: routeTemplate(path), remote: remoteFor(path), navigationType: m.navigationType, ts };
    });
    const body = new Blob([JSON.stringify(records)], { type: 'application/json' });
    if (deps.sendBeacon?.('/api/rum', body)) return;
    deps.report(records).catch(() => undefined); // never retried, never shown (D9-08)
  };

  deps.target.addEventListener('visibilitychange', () => {
    if (deps.target.visibilityState === 'hidden') flush();
  });
  deps.target.addEventListener('pagehide', flush);
  return flush;
}
