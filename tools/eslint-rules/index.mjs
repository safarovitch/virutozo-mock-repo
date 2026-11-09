// @ts-check
// The `nimbus` ESLint plugin (SPEC.md §11.7, TECH-10). Each rule enforces one AGENTS.md hard rule; the
// root eslint.config.mjs decides where each applies. New rules come from repeated review comments and
// are recorded in docs/review-rules.md.
import { noCrossRemoteImport } from './rules/no-cross-remote-import.mjs';
import { noDirectFetch } from './rules/no-direct-fetch.mjs';
import { noHandwrittenQueryKey } from './rules/no-handwritten-query-key.mjs';
import { noPlaywrightSleep } from './rules/no-playwright-sleep.mjs';
import { noRawPermission } from './rules/no-raw-permission.mjs';
import { noRoleCheck } from './rules/no-role-check.mjs';
import { noServerText } from './rules/no-server-text.mjs';
import { noWebsocketOutsideRealtime } from './rules/no-websocket-outside-realtime.mjs';
import { testNameHasId } from './rules/test-name-has-id.mjs';
/** @type {import('eslint').ESLint.Plugin} */
export const nimbus = {
  meta: { name: '@nimbus/eslint-rules' },
  rules: {
    'no-direct-fetch': noDirectFetch,
    'no-raw-permission': noRawPermission,
    'no-role-check': noRoleCheck,
    'no-playwright-sleep': noPlaywrightSleep,
    'test-name-has-id': testNameHasId,
    'no-cross-remote-import': noCrossRemoteImport,
    'no-websocket-outside-realtime': noWebsocketOutsideRealtime,
    'no-handwritten-query-key': noHandwrittenQueryKey,
    'no-server-text': noServerText,
  },
};
export default nimbus;
