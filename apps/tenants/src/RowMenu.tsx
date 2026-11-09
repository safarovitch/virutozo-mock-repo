// Row actions (SPEC-TEN-1, D5-03): a disclosure like the shell's user menu. Escape and an outside click
// close it and return focus to its button. Clicks inside never reach the row (which opens the drawer).
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@nimbus/ui-kit';
import { t } from './messages/en';

export interface RowMenuItem {
  label: string;
  onSelect: () => void;
  /** Shown but unusable, with this tooltip (RBAC-4, D7-15). */
  disabledReason?: string;
}

export function RowMenu({ name, items }: { name: string; items: RowMenuItem[] }) {
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

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  return (
    <div
      ref={root}
      className="tenants-menu"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          close();
        }
      }}
    >
      <button ref={button} type="button" className="nui-button nui-button--ghost" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((v) => !v)}>
        <span aria-hidden="true">⋯</span>
        <span className="nui-visually-hidden">{t('tenants.menu.label', { name })}</span>
      </button>
      <ul id={panelId} className="tenants-menu__panel" hidden={!open}>
        {items.map((item) => (
          <li key={item.label}>
            <Button
              variant="ghost"
              {...(item.disabledReason ? { disabledReason: item.disabledReason } : {})}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
