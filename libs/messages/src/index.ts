// Typed message lookup (MSG-1, MSG-2). A missing key is a type error.
import { en } from './en';

export { en };
export type { MessageKey } from './en';

export type MessageParams = Record<string, string | number | boolean>;
type Catalogue = Record<string, string>;

const plural = new Intl.PluralRules('en');

/** Fills `{name}` placeholders as plain text. Unknown placeholders are left as they are. */
export function interpolate(template: string, params: MessageParams = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** Creates a typed `t()` over a catalogue, e.g. the shared one merged with an area's own. */
export function createTranslator<C extends Catalogue>(catalogue: C) {
  function t(key: keyof C & string, params?: MessageParams): string {
    return interpolate(catalogue[key] ?? key, params);
  }
  /** Plurals: picks `<base>_one` / `<base>_other` with Intl.PluralRules('en') and passes `count` (MSG-2). */
  function tp(base: string, count: number, params: MessageParams = {}): string {
    const key = `${base}_${plural.select(count)}`;
    const template = catalogue[key] ?? catalogue[`${base}_other`] ?? key;
    return interpolate(template, { count, ...params });
  }
  return { t, tp };
}

export const { t, tp } = createTranslator(en);
