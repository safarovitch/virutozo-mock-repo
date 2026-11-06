// Combobox (§8.2, D8-05): WAI-ARIA APG "combobox with listbox popup". Focus stays in the input; the active
// option is `aria-activedescendant`. The owner does the search (`onSearch`, debounced here) and passes the
// results as `options`, so the kit knows nothing about the API. The same markup and CSS as ui-kit-vue.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { t } from '@nimbus/messages';

export interface ComboboxOption {
  id: string;
  label: string;
  /** Muted text after the label, e.g. a slug. */
  description?: string;
  /** Extra content after the text, e.g. a StatusBadge. */
  badge?: ReactNode;
}

export interface ComboboxProps {
  label: string;
  placeholder?: string;
  /** The chosen option's label, shown while the user isn't typing. */
  value?: string;
  options: readonly ComboboxOption[];
  loading?: boolean;
  /** A mapped message for a failed search (MSG-3), shown in the popup. */
  error?: string;
  /** Shown when the search returned nothing. */
  emptyText: string;
  /** Called with the typed text after `searchDelayMs`, and with "" when the popup opens. */
  onSearch: (query: string) => void;
  onSelect: (option: ComboboxOption) => void;
  searchDelayMs?: number;
}

export function Combobox({ label, placeholder, value = '', options, loading = false, error, emptyText, onSearch, onSelect, searchDelayMs = 300 }: ComboboxProps) {
  const inputId = useId();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null); // null: not typing, show `value`
  const [active, setActive] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);
  const optionKey = options.map((o) => o.id).join('\n'); // owners may pass a new array on every render
  useEffect(() => setActive(-1), [optionKey]);

  const search = (query: string, delay: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch(query.trim()), delay);
  };
  const show = () => {
    if (open) return;
    setOpen(true);
    search(text ?? '', 0);
  };
  const close = () => {
    clearTimeout(timer.current);
    setOpen(false);
    setText(null);
    setActive(-1);
  };
  const choose = (option: ComboboxOption) => {
    close();
    onSelect(option);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const count = options.length;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) return show();
      if (count) setActive((i) => (i + 1) % count);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) return show();
      if (count) setActive((i) => (i <= 0 ? count - 1 : i - 1));
    } else if (event.key === 'Enter' && open && active >= 0 && options[active]) {
      event.preventDefault();
      choose(options[active]);
    } else if (event.key === 'Escape' && (open || text !== null)) {
      event.preventDefault();
      event.stopPropagation(); // a combobox in a dialog closes its popup, not the dialog
      close();
    }
  };

  const status = loading ? t('common.loading') : error ? error : options.length === 0 ? emptyText : null;
  const optionId = (i: number) => `${listId}-${i}`;

  return (
    <div className="nui-combobox">
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        className="nui-input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={text ?? value}
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
          search(event.target.value, searchDelayMs);
        }}
        onClick={show}
        onKeyDown={onKeyDown}
        onBlur={close}
      />
      <div className="nui-combobox__popup" hidden={!open}>
        {status && (
          <p className={error && !loading ? 'nui-combobox__status nui-combobox__status--error' : 'nui-combobox__status'} role="status">
            {status}
          </p>
        )}
        <ul id={listId} role="listbox" aria-label={label} className="nui-combobox__list">
          {!loading &&
            !error &&
            options.map((option, i) => (
              <li
                key={option.id}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                className="nui-combobox__option"
                // Keep focus in the input (APG): a click selects without blurring first.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
              >
                <span>{option.label}</span>
                {option.description && <span className="nui-combobox__description">{option.description}</span>}
                {option.badge}
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
