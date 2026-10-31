# libs/design-tokens — local guide

**Purpose:** CSS custom properties from SPEC.md §8.1, the single source for React and Vue.

**Framework and key libraries:** none; importing `@nimbus/design-tokens` loads `tokens.css` once (shared singleton, MF-2).

**Owns:** `src/tokens.css`.

**Local commands:** `pnpm nx run design-tokens:lint`.

**Local pitfalls**
- Add tokens here, never hard-coded colours or spacing in apps.
- Every text/background pair must meet WCAG AA (a token contrast test arrives with TECH-6).
