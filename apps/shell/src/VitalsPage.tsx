// `/_vitals` (SPEC-SHL-5, AC-SHL-5.3, D9-09): p75 per route and metric over the last 24 h, from
// `getVitalsSummary`. Shown only with `vitals:read` (D9-04); not in the sidebar.
import { useQuery } from '@tanstack/react-query';
import { ApiError, messageFor } from '@nimbus/api-client';
import type { VitalSummary } from '@nimbus/api-client/model';
import { getGetVitalsSummaryQueryKey, getVitalsSummary } from '@nimbus/api-client/react';
import { formatCount } from '@nimbus/format';
import { t } from '@nimbus/messages';
import { EmptyState, ErrorState, Skeleton, StatusBadge, type StatusTone } from '@nimbus/ui-kit';

const TONE: Record<VitalSummary['rating'], StatusTone> = { good: 'success', 'needs-improvement': 'warning', poor: 'danger' };

/** LCP, INP, FCP and TTFB in whole milliseconds; CLS is unitless with two decimals. */
export const formatP75 = (row: Pick<VitalSummary, 'metric' | 'p75'>) =>
  row.metric === 'CLS' ? row.p75.toFixed(2) : t('vitals.ms', { value: formatCount(Math.round(row.p75)) });

export function VitalsView({ rows, loading, error, onRetry }: { rows: VitalSummary[] | undefined; loading: boolean; error?: string; onRetry: () => void }) {
  let body;
  if (loading) body = <Skeleton lines={5} label={t('vitals.title')} />;
  else if (error) body = <ErrorState message={error} onRetry={onRetry} />;
  else if (!rows?.length) body = <EmptyState title={t('vitals.empty')} />;
  else {
    const sorted = [...rows].sort((a, b) => a.route.localeCompare(b.route) || a.metric.localeCompare(b.metric));
    body = (
      <table className="vitals-table" aria-label={t('vitals.title')}>
        <thead>
          <tr>
            <th scope="col">{t('vitals.columns.route')}</th>
            <th scope="col">{t('vitals.columns.metric')}</th>
            <th scope="col">{t('vitals.columns.p75')}</th>
            <th scope="col">{t('vitals.columns.rating')}</th>
            <th scope="col">{t('vitals.columns.samples')}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={`${row.route} ${row.metric}`}>
              <th scope="row">{row.route}</th>
              <td>{row.metric}</td>
              <td>{formatP75(row)}</td>
              <td>
                <StatusBadge tone={TONE[row.rating]} label={t(`vitals.rating.${row.rating}`)} />
              </td>
              <td>{formatCount(row.samples)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <section className="page">
      <h1>{t('vitals.title')}</h1>
      <p>{t('vitals.description')}</p>
      {body}
    </section>
  );
}

export function VitalsPage() {
  const query = useQuery({ queryKey: getGetVitalsSummaryQueryKey(), queryFn: async ({ signal }) => (await getVitalsSummary({ signal })).data as VitalSummary[] });
  const error = query.error ? messageFor(query.error instanceof ApiError ? query.error.problem : { code: 'INTERNAL' }) : undefined;
  return <VitalsView rows={query.data} loading={query.isPending && !query.error} {...(error ? { error } : {})} onRetry={() => void query.refetch()} />;
}
