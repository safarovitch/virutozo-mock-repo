// Signed-in layout (SPEC-SHL-2): sidebar with the permitted areas (RBAC-3) and a header with the user menu
// (D3-01). The connection indicator and task center arrive on Day 4, the tenant context bar on Day 6.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { permittedAreas } from '@nimbus/auth';
import type { SessionSnapshot } from '@nimbus/mf-contract';
import { t } from '@nimbus/messages';
import { Button } from '@nimbus/ui-kit';

export function Layout({ session, onSignOut, children }: { session: SessionSnapshot; onSignOut: () => void; children: ReactNode }) {
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
          {/* TODO(SPEC-SHL-8): tenant context bar. TODO(TECH-4): connection indicator. TODO(SPEC-TSK-1): task center. */}
          <UserMenu session={session} onSignOut={onSignOut} />
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
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
