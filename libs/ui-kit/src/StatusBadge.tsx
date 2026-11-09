export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

// Every tone has its own shape, so status is never conveyed by colour alone (NFR-A11Y-3).
const ICONS: Record<StatusTone, string> = {
  success: 'M3 8l3 3 7-7', // check
  warning: 'M8 2l6 12H2z', // triangle
  danger: 'M4 4l8 8M12 4l-8 8', // cross
  info: 'M8 4v1M8 7v5', // i
  neutral: 'M3 8h10', // dash
};

/** Icon + text per status (§8.2). The caller maps its domain status to a tone and a catalogue label. */
export function StatusBadge({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <span className={`nui-badge nui-badge--${tone}`}>
      <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
        <path d={ICONS[tone]} />
      </svg>
      <span className="nui-badge__label">{label}</span>
    </span>
  );
}
