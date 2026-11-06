export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface ComboboxOption {
  id: string;
  label: string;
  /** Muted text after the label, e.g. a slug. */
  description?: string;
  /** A status badge after the text, e.g. a suspended tenant. */
  badge?: { tone: StatusTone; label: string };
}
