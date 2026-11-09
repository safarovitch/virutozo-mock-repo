# tools/eslint-rules — local guide

**Purpose:** the `nimbus` ESLint plugin (SPEC.md §11.7, TECH-10): one rule per AGENTS.md hard rule that lint can check (H2, H3, H5, H7, H10, H13, H14). The root `eslint.config.mjs` decides where each rule applies.

**Framework and key libraries:** ESLint 10 rule API over ESTree (works for `.ts`, `.tsx` and Vue `<script>`), ESLint's own `RuleTester` under Vitest. Rules are plain `.mjs` with `// @ts-check` and JSDoc types (typechecked with `checkJs`).

**Owns:** `rules/*.mjs`, the plugin `index.mjs`, `rules/sources.mjs` (the ID prefixes and permissions, read as text from their TypeScript sources), `rules.test.ts`; the ledger `docs/review-rules.md` (comment → rule → date).

**Local commands:** `pnpm nx run eslint-rules:test` · `pnpm nx run eslint-rules:typecheck` · probe a rule: `printf "fetch('/x')" | npx eslint --stdin --stdin-filename apps/storage/src/probe.ts`.

**Local pitfalls**
- Don't set `RuleTester.describe/it` to Vitest's: RuleTester then nests suites inside a test and Vitest refuses. Its inline fallback throws on the first failing case, which is what the `it` needs.
- Never import a `.ts` file from a rule: HOOK-1 runs ESLint with the shell's default Node (20 here), which can't load TypeScript. `sources.mjs` reads `tools/trace/ids.ts` and the generated `Permission` as text and throws if it finds nothing, so a format change fails loudly.
- `no-raw-permission` uses the generated `Permission` values; never widen it to a pattern (bus events like `'task:started'` look like permissions).
- Nx caches lint: `nx.json` lists this folder and `tools/trace/ids.ts` as lint inputs. Keep it that way when adding a file the rules import.
- A new rule needs: RuleTester cases titled `TECH-10:`, a scope in `eslint.config.mjs`, a row in `docs/review-rules.md`, and the AGENTS.md hard-rule table naming it.
