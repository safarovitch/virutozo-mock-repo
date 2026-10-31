import { usageLevel, formatPercent } from '@nimbus/format';
import { t } from '@nimbus/messages';

/** Determinate when `value` is given (0–1), indeterminate otherwise (§8.2). */
export function ProgressBar({ label, value }: { label: string; value?: number }) {
  const determinate = value !== undefined;
  const percent = determinate ? Math.round(Math.min(Math.max(value, 0), 1) * 100) : undefined;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? 100 : undefined}
      aria-valuenow={percent}
      className="nui-progress"
    >
      <div
        className={determinate ? 'nui-progress__fill' : 'nui-progress__fill nui-progress__fill--indeterminate'}
        style={determinate ? { inlineSize: `${percent}%` } : undefined}
      />
    </div>
  );
}

/**
 * Usage against a quota (§8.2). Thresholds use the exact ratio via `usageLevel` (80 / 95 %); the percent
 * shown is `formatPercent` (floored, may exceed 100 %). Warning and danger also render text (NFR-A11Y-3).
 */
export function UsageBar({ label, used, total, valueText }: { label: string; used: number; total: number; valueText?: string }) {
  const ratio = total > 0 ? used / total : 0;
  const level = usageLevel(ratio);
  const percent = formatPercent(ratio);
  return (
    <div className={`nui-usage nui-usage--${level}`}>
      <div className="nui-usage__text">
        <span>{label}</span>
        <span>{valueText ?? percent}</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={Math.min(used, total)}
        aria-valuetext={valueText ? `${valueText} (${percent})` : percent}
        className="nui-usage__track"
      >
        <div className="nui-usage__fill" style={{ inlineSize: `${Math.min(ratio, 1) * 100}%` }} />
      </div>
      {level !== 'ok' && <span className="nui-usage__level">{t(level === 'warning' ? 'usage.warning' : 'usage.danger')}</span>}
    </div>
  );
}
