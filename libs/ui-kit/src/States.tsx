import type { ReactNode } from 'react';
import { t } from '@nimbus/messages';
import { Button } from './Button';

/** "Nothing here yet" or "no matches" (H6). `action` is usually a Button. */
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <section className="nui-state" aria-label={title}>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action}
    </section>
  );
}

/** A failed load (H6). `message` comes from `messageFor(problem)`, never from server text (MSG-3). */
export function ErrorState({ message, title = t('common.errorTitle'), onRetry }: { message: string; title?: string; onRetry?: () => void }) {
  return (
    <section className="nui-state nui-state--error" role="alert">
      <h2>{title}</h2>
      <p>{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </section>
  );
}

/** Loading placeholder (H6). Announced once as busy; the lines themselves are hidden from assistive tech. */
export function Skeleton({ lines = 3, label = t('common.loading') }: { lines?: number; label?: string }) {
  return (
    <div className="nui-skeleton" role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="nui-skeleton__line" aria-hidden="true" style={{ inlineSize: `${100 - ((i * 17) % 40)}%` }} />
      ))}
    </div>
  );
}
