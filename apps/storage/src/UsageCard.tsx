// The usage card (SPEC-STO-1, D8-10): used / quota through formatBytes, and ui-kit's UsageBar with the
// floored percent as text. Tone from the exact ratio (warning ≥ 0.80, danger ≥ 0.95); over 100% shows the
// real figure and a full bar.
import type { TenantQuotas } from '@nimbus/api-client/model';
import { formatBytes } from '@nimbus/format';
import { ErrorState, Skeleton, UsageBar } from '@nimbus/ui-kit';
import { t } from './messages/en';

export interface UsageCardProps {
  quotas: TenantQuotas | undefined;
  loading: boolean;
  error?: string;
  onRetry: () => void;
}

export function UsageCard({ quotas, loading, error, onRetry }: UsageCardProps) {
  const title = t('storage.usageTitle');
  let body;
  if (error) body = <ErrorState message={error} onRetry={onRetry} />;
  else if (loading || !quotas) body = <Skeleton lines={2} label={title} />;
  else {
    const { storageUsedBytes: used, storageQuotaBytes: quota } = quotas;
    const ratio = quota > 0 ? used / quota : 0;
    const percent = Math.floor(ratio * 100 + 1e-9); // the same flooring as formatPercent (SPEC.md §9)
    body = (
      <>
        <p>{t('storage.usage', { used: formatBytes(used), quota: formatBytes(quota) })}</p>
        <UsageBar label={title} used={used} total={quota} valueText={t('storage.usagePercent', { percent })} />
      </>
    );
  }
  return (
    <section className="nui-card storage-usage" aria-label={title}>
      <h2>{title}</h2>
      {body}
    </section>
  );
}
