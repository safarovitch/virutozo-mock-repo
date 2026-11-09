# Messages & formatting

Shared spec block (moved from SPEC.md §9). Rule IDs MSG-1…MSG-4 are defined only here; the `libs/format` functions are listed here.

- **MSG-1** Every user-facing string lives in a typed catalogue: shared strings in `libs/messages/src/en.ts` (errors, common actions, statuses, connection states), area strings in `apps/<area>/src/messages/en.ts`. A missing key is a type error.
- **MSG-2** Placeholders use `{name}` and are always inserted as text, never HTML. Plurals use `…_one` / `…_other` keys chosen with `Intl.PluralRules('en')`.
- **MSG-3** Server text is never shown. The UI shows the message for `Problem.code`, filled from `Problem.params`. Unknown codes show the `INTERNAL` message. `title` / `detail` go to the logger only (lint: `nimbus/no-server-text`).
- **MSG-4** Single source of wording: `specs/mock-data.md` SPEC.md §9 for error texts and SPEC.md §10 for other UI strings referenced by ACs. ACs quote the message key plus the expected text. A unit test checks that every `ErrorCode` has a message.

Formatting lives in `libs/format`: framework-agnostic, pure, shared by React and Vue, every function unit-tested with the examples below. Locale handling is internal (the table). ACs and messages reference these names (e.g. "`{max}` formatted with `formatBytes`").

```ts
formatBytes(bytes: number): string                      // 107374182400 → "100 GiB", 1610612736 → "1.5 GiB", 0 → "0 B"
gibToBytes(gib: number): number                         // 100 → 107374182400 (quota inputs)
bytesToGib(bytes: number): number                       // 107374182400 → 100 (prefilling inputs)
formatPercent(ratio: number): string                    // 0.799 → "79%", 1.04 → "104%"
usageLevel(ratio: number): 'ok' | 'warning' | 'danger'  // < 0.8 ok, < 0.95 warning, else danger (exact ratio)
formatCount(n: number): string                          // 10000 → "10,000"
formatDateTime(iso: string): string                     // → "30 Oct 2026, 22:01" (browser time zone)
formatRelativeTime(iso: string, now?: Date): string     // → "2 minutes ago" (< 24 h; older → formatDateTime)
formatMoney(money: Money): string                       // { amountMicros: 35000, currency: 'EUR' } → "€0.035"
```

Rules behind them:

| What | Rule | Example |
|---|---|---|
| Bytes | binary units; trailing `.0` dropped; one decimal otherwise; none for B | `100 GiB`, `1.5 GiB`, `0 B` |
| Quota input | whole GiB, converted to bytes | `100` → `107374182400` |
| Percent | display `Math.floor`; thresholds use the exact ratio | 79.9% → "79%", no warning |
| Over quota | real value, danger style | `104%` |
| Date/time | `Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })`, browser time zone; tooltip shows ISO UTC | `30 Oct 2026, 22:01` |
| Recent (< 24 h) | `Intl.RelativeTimeFormat('en', { numeric: 'auto' })` | `2 minutes ago` |
| Counts | `Intl.NumberFormat('en-GB')` | `10,000` |
| Money | `Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 4 })` on `amountMicros / 1e6` | `€0.035` |
