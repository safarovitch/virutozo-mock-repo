// Signed-in layout (SPEC-SHL-2): sidebar with the permitted areas (RBAC-3) and a header with the connection
// indicator (WS-4), the task center (SPEC-TSK-1), the user menu (D3-01) and, for tenant roles, the tenant
// context bar and the suspended banner (SPEC-SHL-8).
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { Permission } from '@nimbus/api-client/model';
import { can, permittedAreas } from '@nimbus/auth';
import type { RootBus, SessionSnapshot } from '@nimbus/mf-contract';
import { t } from '@nimbus/messages';
import type { TenantStatus } from '@nimbus/api-client/model';
import { Button, StatusBadge, type StatusTone } from '@nimbus/ui-kit';
import { ConnectionIndicator } from './ConnectionIndicator';
import { TaskCenter } from './TaskCenter';

export function Layout(props: { session: SessionSnapshot; bus: RootBus; onSignOut: () => void; children: ReactNode }) {
  const { session, bus, onSignOut, children } = props;
  return (
    <div className="layout">
      <nav aria-label="Main" className="sidebar">
        <p className="brand">Nimbus Console</p>
        <ul>
          {permittedAreas(session).map((area) => (
            <li key={area}>
              {/* NavLink sets aria-current="page" on the active item (AC-SHL-2.3). */}
              <NavLink to={`/${area}`}>{t(`areas.${area}`)}</NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="main">
        <header className="header">
          {session.tenant && <TenantContext tenant={session.tenant} />}
          <ConnectionIndicator bus={bus} />
          {/* D4-13: without task:read there is no task center. */}
          {can(session, Permission['task:read']) && <TaskCenter bus={bus} session={session} />}
          <UserMenu session={session} onSignOut={onSignOut} />
        </header>
        {/* Always present so the change is announced (AC-SHL-8.2); empty unless the tenant is suspended. */}
        <div role="status" className="tenant-banner-region">
          {session.tenant?.status === 'suspended' && <p className="tenant-banner">{t('tenantStatus.suspendedBanner')}</p>}
        </div>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

const TENANT_TONES: Record<TenantStatus, StatusTone> = { active: 'success', suspended: 'warning', provisioning: 'info', error: 'danger' };

/** AC-SHL-8.1: "{displayName} · {planName} · {status}", the status as a badge (never colour alone). */
function TenantContext({ tenant }: { tenant: NonNullable<SessionSnapshot['tenant']> }) {
  const [before, after = ''] = t('shell.tenantContext', { displayName: tenant.displayName, planName: tenant.planName, status: '{status}' }).split('{status}');
  return (
    <p className="tenant-context">
      {before}
      <StatusBadge tone={TENANT_TONES[tenant.status]} label={t(`status.tenant.${tenant.status}`)} />
      {after}
    </p>
  );
}

/** D3-01: a disclosure button with the user's name; it shows the role (context only, RBAC-1) and Sign out. */
function UserMenu({ session, onSignOut }: { session: SessionSnapshot; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  return (
    <div
      ref={root}
      className="user-menu"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      {/* The label starts with "Account" and contains the visible name (WCAG 2.5.3). */}
      <button
        ref={button}
        type="button"
        className="nui-button nui-button--ghost"
        aria-label={`${t('shell.userMenu')}: ${session.user.name}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        {session.user.name}
      </button>
      <div id={panelId} className="user-menu__panel" hidden={!open}>
        <p>{session.user.email}</p>
        <p>{t(`roles.${session.role}`)}</p>
        <Button onClick={onSignOut}>{t('auth.signOut')}</Button>
      </div>
    </div>
  );
}
