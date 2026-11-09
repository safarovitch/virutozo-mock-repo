// Small shell pages: 403 (RBAC-5, AC-SHL-3.1), not found, boot loader and boot error.
import { Link } from 'react-router';
import { messageFor, type ApiError } from '@nimbus/api-client';
import type { AreaName } from '@nimbus/auth';
import { t } from '@nimbus/messages';
import { ErrorState, Skeleton } from '@nimbus/ui-kit';

export function NoAccessPage({ home }: { home: AreaName | null }) {
  return (
    <section className="page">
      <h1>{t('shell.noAccess.title')}</h1>
      <p>{t('shell.noAccess.body')}</p>
      {/* D3-09: a session without any area gets no link; Sign out stays in the header. */}
      {home && <Link to={`/${home}`}>{t('shell.noAccess.goHome', { area: t(`areas.${home}`) })}</Link>}
    </section>
  );
}

export function NotFoundPage() {
  return (
    <section className="page">
      <h1>{t('shell.notFound')}</h1>
    </section>
  );
}

/** Full-page loader while `getMe` is pending: no protected content renders before it (AC-SHL-3.3). */
export function BootLoader() {
  return (
    <main className="boot">
      <Skeleton lines={4} label={t('common.loading')} />
    </main>
  );
}

export function BootError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <main className="boot">
      <ErrorState message={messageFor((error as Partial<ApiError>).problem ?? { code: 'INTERNAL' })} onRetry={onRetry} />
    </main>
  );
}
