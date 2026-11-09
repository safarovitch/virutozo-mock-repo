// Reads `x-permission` for every operation from contracts/openapi.yaml, so RBAC isn't duplicated by hand
// (Day 2 prompt). Operations without it (login, logout, getMe, reportVitals) need no permission.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { Permission } from '@nimbus/api-client/model';

type Operation = { operationId?: string; 'x-permission'?: Permission; security?: unknown[] };

export function loadOperationPermissions(specUrl = new URL('../../../contracts/openapi.yaml', import.meta.url)) {
  const spec = parse(readFileSync(specUrl, 'utf8')) as { paths: Record<string, Record<string, Operation>> };
  const permissions = new Map<string, Permission | null>();
  for (const item of Object.values(spec.paths)) {
    for (const op of Object.values(item)) {
      if (op && typeof op === 'object' && op.operationId) permissions.set(op.operationId, op['x-permission'] ?? null);
    }
  }
  return permissions;
}
