import { useId, type ButtonHTMLAttributes, type MouseEvent, type ReactNode, type Ref } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  /** Shows a spinner and ignores clicks (§8.2: "click while loading does nothing"). */
  loading?: boolean;
  /**
   * The action exists but the user can't use it (RBAC-4, R20/D3-10): the button stays focusable with
   * `aria-disabled`, ignores clicks, and shows this text as a tooltip on hover and focus.
   */
  disabledReason?: string;
  /** React 19: `ref` is a plain prop, passed to the `<button>` (focus return, AC-TEN-2.6). */
  ref?: Ref<HTMLButtonElement>;
  children: ReactNode;
}

export function Button({ variant = 'secondary', loading = false, disabledReason, disabled, onClick, className, type = 'button', children, ...rest }: ButtonProps) {
  const tooltipId = useId();
  const inert = loading || Boolean(disabledReason);
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (inert) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };
  const button = (
    <button
      {...rest}
      type={type}
      className={['nui-button', `nui-button--${variant}`, className].filter(Boolean).join(' ')}
      disabled={disabled}
      aria-disabled={inert || undefined}
      aria-busy={loading || undefined}
      aria-describedby={disabledReason ? tooltipId : rest['aria-describedby']}
      onClick={handleClick}
    >
      {loading && <span className="nui-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
  if (!disabledReason) return button;
  return (
    <span className="nui-tooltip-anchor">
      {button}
      <span role="tooltip" id={tooltipId} className="nui-tooltip">
        {disabledReason}
      </span>
    </span>
  );
}
