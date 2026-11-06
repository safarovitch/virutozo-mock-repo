# libs/ui-kit-vue — local guide

**Purpose:** the Vue subset of the design system that Compute needs (SPEC.md §8.2): Button, StatusBadge, ProgressBar, EmptyState / ErrorState / Skeleton, ConfirmDialog, Drawer, and `createCanDirective` (`v-can`, from `@nimbus/auth/vue`).

**Framework and key libraries:** Vue 3.5 (`<script setup lang="ts">`), Storybook 10.6 (`@storybook/vue3-vite`, `@storybook/addon-vitest`), Testing Library for Vue.

**Owns:** the Vue components only. Their CSS is `@nimbus/design-tokens/components.css`, shared with the React kit, so both look the same.

**Local commands:** `pnpm nx run ui-kit-vue:test` (jsdom: every story renders) · `pnpm nx run ui-kit-vue:storybook-test` (play functions in Chromium) · `pnpm nx run ui-kit-vue:storybook` (6007).

**Local pitfalls**
- Files are `Nui<Name>.vue` (Vue's multi-word rule); export them under the plain name from `src/index.ts`.
- Keep behaviour identical to the React component of the same name; change both together.
- Stories use render functions (`h`), not template strings: jsdom loads Vue's runtime-only build.
- Not an MF shared singleton: Vue stays bundled in the compute remote (ADR-0001 R2).
- No DataTable: the VM list is a semantic `<table>` in compute (at most 200 rows per page, D6-04), see A3-02.
- `Combobox` (`NuiCombobox.vue`) mirrors ui-kit's React `Combobox`; option badges are `{ tone, label }` instead of a node.
