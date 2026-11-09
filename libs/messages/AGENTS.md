# libs/messages — local guide

**Purpose:** the shared message catalogue (MSG-1) and typed lookup: `t(key, params)`, `tp(base, count)`, `createTranslator(catalogue)` for areas.

**Framework and key libraries:** none; `Intl.PluralRules('en')`.

**Owns:** `errors.*`, `tenantStatus.*`, `status.*`, `connections.*`, `rbac.*`, `actions.*`, `areas.*`. Area strings live in `apps/<area>/src/messages/en.ts`.

**Local commands:** `pnpm nx run messages:test`.

**Local pitfalls**
- Wording comes from `specs/mock-data.md` §9–§10; change it there first. Never reword a `draft` string yourself (E6).
- Placeholders are inserted as text; never build HTML from messages (MSG-2, H8).
