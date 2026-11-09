import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { t } from '@nimbus/messages';

export type ToastTone = 'success' | 'info' | 'error';
export interface ToastInput {
  tone: ToastTone;
  /** Already-translated text (MSG-1); for API errors use `messageFor(problem)` (MSG-3). */
  message: string;
}
interface ToastItem extends ToastInput {
  id: number;
}

/** D3-02: success and info close after 5 s (paused while hovered or focused); errors stay until dismissed. */
export const TOAST_TIMEOUT_MS = 5000;

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

export function useToast(): (toast: ToastInput) => void {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast() needs a <ToastProvider> above it');
  return show;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const show = useCallback((toast: ToastInput) => {
    const id = nextId.current++;
    setToasts((list) => [...list, { ...toast, id }]);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((x) => x.id !== id)), []);
  const value = useMemo(() => show, [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <section className="nui-toasts" aria-label={t('common.notifications')}>
        {/* Two live regions, present before any toast arrives, so screen readers announce new ones. */}
        <div role="status" aria-live="polite">
          {toasts.filter((x) => x.tone !== 'error').map((x) => (
            <ToastView key={x.id} toast={x} onDismiss={dismiss} />
          ))}
        </div>
        <div role="alert" aria-live="assertive">
          {toasts.filter((x) => x.tone === 'error').map((x) => (
            <ToastView key={x.id} toast={x} onDismiss={dismiss} />
          ))}
        </div>
      </section>
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const autoDismiss = toast.tone !== 'error';
  useEffect(() => {
    if (!autoDismiss || paused) return;
    // Restarts the full timeout after a pause, so a user who just read it gets the whole time again.
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [autoDismiss, paused, onDismiss, toast.id]);
  return (
    <div
      className={`nui-toast nui-toast--${toast.tone}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <p className="nui-toast__message">{toast.message}</p>
      <button type="button" className="nui-button nui-button--ghost" onClick={() => onDismiss(toast.id)}>
        {t('common.dismiss')}
      </button>
    </div>
  );
}
