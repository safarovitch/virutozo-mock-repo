// The Storage area root. Without `bucket:read` it never renders data (RBAC-5); the shell's 403 page normally
// catches this first (AC-SHL-3.1).
import { Permission } from '@nimbus/api-client/model';
import type { RemoteContext } from '@nimbus/mf-contract';
import { EmptyState, SessionProvider, useCan } from '@nimbus/ui-kit';
import { CtxContext, useCtx } from './context';
import { t } from './messages/en';
import { StorageArea } from './StorageArea';

export function App({ ctx }: { ctx: RemoteContext }) {
  return (
    <CtxContext.Provider value={ctx}>
      <SessionProvider session={ctx.session}>
        <Root />
      </SessionProvider>
    </CtxContext.Provider>
  );
}

function Root() {
  const ctx = useCtx();
  const canRead = useCan(Permission['bucket:read']);
  // SPEC-SHL-4: a render-time crash for tests, removed from production builds (ci/no-test-hooks).
  if (import.meta.env.MODE !== 'production' && ctx.path.split(/[?#]/)[0] === '/__crash') return <Crash />;
  if (!canRead) return <EmptyState title={t('shell.noAccess.title')} description={t('shell.noAccess.body')} />;
  return <StorageArea />;
}

function Crash(): never {
  throw new Error('storage: render crash for tests');
}
