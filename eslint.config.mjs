// ESLint 10 flat config, shared by every project (`eslint .` from the project root).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import globals from 'globals';
import nimbus from './tools/eslint-rules/index.mjs';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/dist-e2e/**', '**/node_modules/**', '**/coverage/**', '**/tsp-output/**', '**/test-results/**', '**/playwright-report/**', '**/src/generated/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // AGENTS.md H9: no `any` without a `// reason:` comment; no @ts-ignore.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-ignore': true, 'ts-expect-error': 'allow-with-description' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] } },
  },

  // ── AGENTS.md hard rules as lint (SPEC.md §11.7, TECH-10; docs/review-rules.md) ──
  { plugins: { nimbus } },
  {
    // H5: every test title starts with an ID.
    files: ['**/*.test.{ts,tsx,mts,mjs}', '**/*.spec.ts', '**/*.perf.ts'],
    rules: { 'nimbus/test-name-has-id': 'error' },
  },
  {
    // H10: Playwright waits on conditions, never on time.
    files: ['apps/e2e/**/*.ts'],
    rules: { 'nimbus/no-playwright-sleep': 'error' },
  },
  {
    // H7: apps never import each other.
    files: ['apps/{shell,tenants,storage,compute}/**/*.{ts,tsx,vue}'],
    rules: { 'nimbus/no-cross-remote-import': 'error' },
  },
  {
    // Browser code: the shell, the remotes and the libraries they use.
    files: ['apps/{shell,tenants,storage,compute}/src/**/*.{ts,tsx,vue}', 'libs/*/src/**/*.{ts,tsx,vue}'],
    ignores: ['**/*.test.*', '**/*.stories.*', '**/testing/**', '**/test-setup.ts'],
    rules: {
      'nimbus/no-direct-fetch': 'error', // H2
      'nimbus/no-raw-permission': 'error', // H3
      'nimbus/no-role-check': 'error', // H3
      'nimbus/no-websocket-outside-realtime': 'error', // H13
      'nimbus/no-handwritten-query-key': 'error', // H13
      'nimbus/no-server-text': 'error', // H14
      // H8: no raw HTML, no session data in web storage.
      'vue/no-v-html': 'error',
      'no-restricted-syntax': ['error', { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'No dangerouslySetInnerHTML (AGENTS.md H8).' }],
      'no-restricted-globals': ['error', ...['localStorage', 'sessionStorage', 'indexedDB'].map((name) => ({ name, message: 'No session data in web storage (AGENTS.md H8, NFR-SEC-3).' }))],
      'no-restricted-properties': ['error', ...['localStorage', 'sessionStorage', 'indexedDB'].flatMap((property) => ['window', 'globalThis'].map((object) => ({ object, property, message: 'No session data in web storage (AGENTS.md H8).' })))],
    },
  },
  {
    // The places that own what the rules forbid elsewhere: the generated client and customFetch (fetch,
    // Problem), the realtime client (the WebSocket), and the RBAC library (roles → permissions).
    files: ['libs/api-client/src/**', 'libs/realtime/src/**', 'libs/auth/src/**'],
    rules: { 'nimbus/no-direct-fetch': 'off', 'nimbus/no-websocket-outside-realtime': 'off', 'nimbus/no-role-check': 'off', 'nimbus/no-raw-permission': 'off', 'nimbus/no-server-text': 'off' },
  },
);
