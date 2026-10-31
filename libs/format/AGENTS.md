# libs/format — local guide

**Purpose:** the formatting functions from `specs/shared/messages-and-format.md` (`formatBytes`, `gibToBytes`, `bytesToGib`, `formatPercent`, `usageLevel`, `formatCount`, `formatDateTime`, `formatRelativeTime`, `formatMoney`).

**Framework and key libraries:** none; `Intl` only.

**Owns:** every user-visible number, size, date and price format.

**Local commands:** `pnpm nx run format:test` (runs with `TZ=UTC`).

**Local pitfalls**
- Percent is floored with a small epsilon (`0.29 * 100` is 28.999…); thresholds use the exact ratio.
- Add a test with the spec's example for every new rule; don't format numbers inline in apps.
