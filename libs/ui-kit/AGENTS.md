# libs/ui-kit — local guide

**Purpose:** the React design system (SPEC.md §8.2): Button, StatusBadge, ProgressBar, UsageBar, EmptyState / ErrorState / Skeleton, Toast, Dialog / ConfirmDialog, Drawer, Wizard, DataTable, and `Can` (re-exported from `@nimbus/auth/react`).

**Framework and key libraries:** React 19, TanStack Table 9 (`useTable`, `rowSortingFeature`), TanStack Virtual 3, Storybook 10.6 (`@storybook/react-vite`, `@storybook/addon-vitest`).

**Owns:** `src/styles.css` (tokens only, logical properties, `nui-` prefix); one story per state; `play` stories for behaviour. Shared singleton for the React apps (D1-11).

**Local commands:** `pnpm nx run ui-kit:test` (jsdom: unit + every story renders) · `pnpm nx run ui-kit:storybook-test` (play functions in Chromium, CI `ci/storybook-test`) · `pnpm nx run ui-kit:storybook` (6006).

**Local pitfalls**
- Stories that are tests get `tags: ['play']` and a name starting with an ID (`TECH-6: …`); only those run in the browser (H5).
- No inline strings: labels come from props or `@nimbus/messages` `common.*` (MSG-1).
- Native `<dialog>` closes only on trusted Escape; the Modal handles Escape on keydown so synthetic events in tests behave like real ones.
- jsdom has no `showModal`; `src/test-setup.ts` stubs it. Test focus and Escape in a `play` story, not in jsdom.
- DataTable never sorts rows itself (`manualSorting`): the caller owns `sorting` (URL) and the order of `data`.
- TanStack Table 9 differs from v8: read `node_modules/@tanstack/react-table/skills/*` before changing DataTable.
