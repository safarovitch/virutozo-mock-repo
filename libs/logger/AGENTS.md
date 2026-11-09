# libs/logger — local guide

**Purpose:** framework-agnostic logger (SPEC.md §9 Logging): `createLogger(source)` → `error | warn | info(event, data?)`, console prefix `[nimbus][<source>] <event>`, ring buffer of the last 200 entries.

**Framework and key libraries:** none.

**Owns:** the shared entry buffer (`logEntries()`), read by tests and the dev-only `/_debug` page.

**Local commands:** `pnpm nx run logger:test`.

**Local pitfalls**
- Event names are dotted and stable (`realtime.invalid_message`); tests assert on them.
- Call `configureLogger({ production })` once at start-up; production drops `info`.
- Never log secrets or cookie values.
