# Review → lint rules

Repeated review comments become lint rules (SPEC.md §11.7). One row per rule: the comment it replaces, the rule, where it applies, and when it shipped. Rules live in `tools/eslint-rules/`; scopes are in the root `eslint.config.mjs`.

| Review comment | Rule | Applies to | Added |
|---|---|---|---|
| "Use the generated client, not fetch" (H2) | `nimbus/no-direct-fetch` | browser code in `apps/{shell,tenants,storage,compute}/src`, `libs/*/src`; off in `libs/api-client` | 2026-11-06 (TECH-10) |
| "Use the `Permission` enum, not a string" (H3) | `nimbus/no-raw-permission` | browser code, not tests, stories or `testing/`; off in `libs/auth`, `libs/api-client` | 2026-11-06 (TECH-10) |
| "Don't check role names, use `can()`" (H3) | `nimbus/no-role-check` | browser code; off in `libs/auth` (it maps roles to permissions) | 2026-11-06 (TECH-10) |
| "Test titles start with an ID" (H5, TEST-1) | `nimbus/test-name-has-id` | every `*.test.*`, `*.spec.ts`, `*.perf.ts` | 2026-11-06 (TECH-10) |
| "Remotes don't import each other" (H7, MF-3) | `nimbus/no-cross-remote-import` | `apps/{shell,tenants,storage,compute}` | 2026-11-06 (TECH-10) |
| "No sleeps in Playwright" (H10) | `nimbus/no-playwright-sleep` | `apps/e2e` | 2026-11-06 (TECH-10) |
| "Only libs/realtime opens a socket" (H13, RT-1) | `nimbus/no-websocket-outside-realtime` | browser code; off in `libs/realtime` | 2026-11-06 (TECH-10) |
| "Use Orval's query-key helper" (H13, RT-4) | `nimbus/no-handwritten-query-key` | browser code | 2026-11-06 (TECH-10) |
| "Never show problem.title/detail" (H14, MSG-3) | `nimbus/no-server-text` | browser code; off in `libs/api-client` | 2026-11-06 (TECH-10) |
| "No raw HTML, no session data in web storage" (H8) | `vue/no-v-html`, `no-restricted-syntax` (`dangerouslySetInnerHTML`), `no-restricted-globals` / `no-restricted-properties` (`localStorage`, `sessionStorage`, `indexedDB`) | browser code | 2026-11-06 (TECH-10) |
