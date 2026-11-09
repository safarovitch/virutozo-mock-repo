// SPEC.md §8.1: every text/background pair meets WCAG AA (4.5:1 for normal text). The pairs are the
// ones components.css uses; add one here when you add one there.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const token = (name: string): string => {
  const match = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!match?.[1]) throw new Error(`--color-${name} is not a 6-digit hex colour`);
  return match[1];
};

/** WCAG 2.2 relative luminance and contrast ratio. */
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

// [text, background, where]
const PAIRS: [string, string, string][] = [
  ['text', 'bg', 'body text'],
  ['text', 'surface', 'table header, selected row, sidebar'],
  ['text-muted', 'bg', 'state descriptions'],
  ['text-muted', 'surface', 'muted text in the sidebar'],
  ['bg', 'primary', 'primary button'],
  ['bg', 'danger', 'danger button'],
  ['bg', 'text', 'tooltip'],
  ['primary', 'bg', 'ghost button, info badge, links'],
  ...(['success', 'warning', 'danger', 'primary'] as const).flatMap((tone): [string, string, string][] => [
    [tone, 'bg', `${tone} badge and usage text`],
    [tone, 'surface', `${tone} badge on a selected row`],
  ]),
];

describe('design tokens', () => {
  for (const [fg, bg, where] of PAIRS) {
    it(`TECH-6: --color-${fg} on --color-${bg} meets WCAG AA (${where})`, () => {
      expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
    });
  }
});
