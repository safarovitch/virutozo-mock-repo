// Demo login (SPEC-SHL-1): pick one of the four seeded roles, then Sign in.
import { useId, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { messageFor, type ApiError } from '@nimbus/api-client';
import { Role } from '@nimbus/api-client/model';
import { t } from '@nimbus/messages';
import { Button } from '@nimbus/ui-kit';

const ROLES = Object.values(Role);

export function LoginPage({ onSignIn }: { onSignIn: (role: Role) => Promise<void> }) {
  const [params] = useSearchParams();
  const [role, setRole] = useState<Role>(Role.provider_admin);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groupId = useId();
  const expired = params.get('reason') === 'expired';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSignIn(role);
    } catch (e) {
      // MSG-3: the message for Problem.code, never the server's title or detail.
      setError(messageFor((e as Partial<ApiError>).problem ?? { code: 'INTERNAL' }));
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <h1>{t('auth.title')}</h1>
      {/* The message survives a reload of /login because it comes from the URL (AC-SHL-1.4). */}
      {expired && <p role="alert">{t('errors.UNAUTHENTICATED')}</p>}
      {error && <p role="alert">{error}</p>}
      <form onSubmit={submit}>
        <fieldset aria-labelledby={groupId}>
          <legend id={groupId}>{t('auth.roleLabel')}</legend>
          {ROLES.map((r) => (
            <label key={r} className="login__role">
              <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} />
              {t(`roles.${r}`)}
            </label>
          ))}
        </fieldset>
        <Button type="submit" variant="primary" loading={busy}>
          {t('auth.signIn')}
        </Button>
      </form>
    </main>
  );
}
