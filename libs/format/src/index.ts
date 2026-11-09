// Formatting shared by React and Vue (specs/shared/messages-and-format.md). Pure functions; locale handling is internal.

const GIB = 1024 ** 3;
const UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'] as const;

/** Binary units, one decimal, trailing ".0" dropped, no decimals for bytes: 107374182400 → "100 GiB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 1024) return `${Math.max(0, Math.round(bytes || 0))} B`;
  let unit = 0;
  let value = bytes;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  let rounded = Math.round(value * 10) / 10;
  if (rounded >= 1024 && unit < UNITS.length - 1) {
    rounded = Math.round((rounded / 1024) * 10) / 10;
    unit++;
  }
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} ${UNITS[unit]}`;
}

/** Whole GiB from a quota input → bytes: 100 → 107374182400. */
export function gibToBytes(gib: number): number {
  return Math.round(gib) * GIB;
}

/** Bytes → GiB for prefilling inputs: 107374182400 → 100. */
export function bytesToGib(bytes: number): number {
  return bytes / GIB;
}

/**
 * Displayed percent is floored; thresholds use the exact ratio (usageLevel).
 * The epsilon absorbs floating-point error such as 0.29 * 100 = 28.999999999999996.
 */
export function formatPercent(ratio: number): string {
  return `${Math.floor(ratio * 100 + 1e-9)}%`;
}

export function usageLevel(ratio: number): 'ok' | 'warning' | 'danger' {
  if (ratio < 0.8) return 'ok';
  if (ratio < 0.95) return 'warning';
  return 'danger';
}

const counts = new Intl.NumberFormat('en-GB');
export function formatCount(n: number): string {
  return counts.format(n);
}

const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
/** Browser time zone: "30 Oct 2026, 22:01". */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
/** Less than 24 h away: "2 minutes ago"; otherwise formatDateTime. */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffSeconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSeconds);
  if (abs >= 24 * 3600) return formatDateTime(iso);
  if (abs < 60) return relative.format(diffSeconds, 'second');
  if (abs < 3600) return relative.format(Math.round(diffSeconds / 60), 'minute');
  return relative.format(Math.round(diffSeconds / 3600), 'hour');
}

/** Contract `Money`: amount in micro-units of the currency. */
export interface MoneyLike {
  amountMicros: number;
  currency: string;
}

export function formatMoney(money: MoneyLike): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: money.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(money.amountMicros / 1e6);
}
