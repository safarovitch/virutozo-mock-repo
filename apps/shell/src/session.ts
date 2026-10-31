import type { SessionSnapshot } from '@nimbus/mf-contract';

// TODO(SPEC-SHL-1): replace with the real session from GET /api/me (Day 3).
// Until sign-in exists, remotes get an anonymous snapshot with no permissions.
export const ANONYMOUS_SESSION: SessionSnapshot = Object.freeze({
  user: Object.freeze({ id: 'anonymous', name: 'Anonymous', email: '' }),
  role: 'tenant_viewer',
  tenant: null,
  permissions: Object.freeze([]),
});
