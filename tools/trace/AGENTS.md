# tools/trace — local guide

**Purpose:** traceability (SPEC.md §3.3, TECH-5): `ids.ts` (allowed ID prefixes, the registry read from the specs) and `check.ts` (rules T1–T6, the coverage report). Entry point: `tools/check-trace.ts` (`pnpm trace`, CI `ci/trace-check`).

**Framework and key libraries:** plain TypeScript run by Node 22's type stripping (`node tools/check-trace.ts`): no build, no `tsx`. Vitest for its own tests.

**Owns:** the ID prefix list (AGENTS.md H5; TECH-10's lint rule reads it too) and how test titles, AC statuses, retired IDs and `verify:` jobs are read.

**Local commands:** `pnpm trace` · `pnpm trace --pr-body <file>` (T1, T2, T6 too) · `pnpm nx run trace:test`.

**Local pitfalls**
- Node runs these files without compiling: import with the `.ts` extension, and use only erasable syntax (no `enum`, no parameter properties, no namespaces).
- Titles are read statically. Only `it(`/`test(` in code count; the same text inside a string or comment (test fixtures) doesn't (`codeMask`).
- Story names count only when they start with an ID (`TECH-6: …`); plain state stories have none.
- Passing isn't checked here: the blocking test jobs prove it, with 0 retries (TEST-4).
