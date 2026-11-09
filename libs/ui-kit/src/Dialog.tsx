import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { t } from '@nimbus/messages';
import { Button } from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Native modal `<dialog>`: the rest of the page is inert while it's open (focus trap), Escape closes it,
 * and focus returns to the element that opened it (NFR-A11Y-4). Shared by Dialog and Drawer.
 */
export function Modal({ open, onClose, title, children, footer, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (open) return;
    opener.current?.focus();
    opener.current = null;
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={['nui-dialog', className].filter(Boolean).join(' ')}
      aria-labelledby={titleId}
      // Escape: the owner decides what closing means (it may push a URL, url-conventions). Handled on
      // keydown so the native cancel never closes the dialog behind React's back.
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation(); // a dialog opened over another (a discard prompt) closes alone
        onClose();
      }}
      onCancel={(event) => event.preventDefault()}
    >
      {open && (
        <>
          <header className="nui-dialog__header">
            <h2 id={titleId}>{title}</h2>
            <Button variant="ghost" onClick={onClose}>
              {t('common.close')}
            </Button>
          </header>
          <div className="nui-dialog__body">{children}</div>
          {footer && <footer className="nui-dialog__footer">{footer}</footer>}
        </>
      )}
    </dialog>
  );
}

export function Dialog(props: ModalProps) {
  return <Modal {...props} />;
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** What will happen, in plain words. */
  children: ReactNode;
  /** A verb naming the result, e.g. "Suspend tenant" (F10 checklist). */
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
  /** Type-to-confirm (§8.2): Confirm stays disabled until the input matches exactly. */
  confirmText?: string;
  busy?: boolean;
}

export function ConfirmDialog({ open, title, children, confirmLabel, onConfirm, onCancel, danger = false, confirmText, busy = false }: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const inputId = useId();
  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);
  const matches = confirmText === undefined || typed === confirmText;
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} disabled={!matches} loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
      {confirmText !== undefined && (
        <div className="nui-field">
          <label htmlFor={inputId}>{t('common.typeToConfirm', { value: confirmText })}</label>
          <input id={inputId} className="nui-input" value={typed} autoComplete="off" spellCheck={false} onChange={(e) => setTyped(e.target.value)} />
        </div>
      )}
    </Modal>
  );
}

/**
 * A side panel over the page (§8.2). URL-addressable: the owner derives `open` from the URL and
 * `onClose` navigates (specs/shared/url-conventions.md). Focus is trapped and restored like a Dialog.
 */
export function Drawer(props: Omit<ModalProps, 'className'>) {
  return <Modal {...props} className="nui-drawer" />;
}
