# libs/design-tokens — local guide

**Purpose:** CSS custom properties from SPEC.md §8.1, the single source for React and Vue, plus `components.css`, the component styles shared by ui-kit and ui-kit-vue.

**Framework and key libraries:** none; importing `@nimbus/design-tokens` loads `tokens.css` once (shared singleton, MF-2).

**Owns:** `src/tokens.css`, `src/components.css` (tokens only, logical properties, `nui-` prefix).

**Local commands:** `pnpm nx run design-tokens:lint`.

**Local pitfalls**
- Add tokens here, never hard-coded colours or spacing in apps.
- Every text/background pair must meet WCAG AA; `src/contrast.test.ts` checks the pairs the components use. Add a pair there when you add one in CSS.
