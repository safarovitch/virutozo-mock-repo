// RFC 9457 problem responses (API-2). The UI shows the message for `code`, never `title` (MSG-3).
import type { FastifyReply } from 'fastify';
import type { ErrorCode, FieldError, ProblemParams } from '@nimbus/api-client/model';
import type { ZodError } from 'zod';

const TITLES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: 'Not signed in',
  FORBIDDEN: 'Forbidden',
  NOT_FOUND: 'Not found',
  VALIDATION_FAILED: 'Validation failed',
  TENANT_NAME_TAKEN: 'Tenant name taken',
  TENANT_NOT_ACTIVE: 'Tenant not active',
  TENANT_NOT_SUSPENDED: 'Tenant not suspended',
  TENANT_SUSPENDED: 'Tenant suspended',
  QUOTA_EXCEEDS_PLAN: 'Quota exceeds plan',
  QUOTA_BELOW_USAGE: 'Quota below usage',
  QUOTA_EXCEEDED: 'Quota exceeded',
  VM_BUSY: 'VM busy',
  VM_INVALID_STATE: 'Invalid VM state',
  BUCKET_NAME_TAKEN: 'Bucket name taken',
  BUCKET_NOT_EMPTY: 'Bucket not empty',
  RATE_LIMITED: 'Rate limited',
  INTERNAL: 'Internal error',
};

export function problemBody(status: number, code: ErrorCode, extra: { params?: ProblemParams; errors?: FieldError[]; detail?: string } = {}) {
  return { title: TITLES[code], status, code, ...extra };
}

export function sendProblem(
  reply: FastifyReply,
  status: number,
  code: ErrorCode,
  extra: { params?: ProblemParams; errors?: FieldError[]; detail?: string } = {},
) {
  return reply.code(status).type('application/problem+json').send(problemBody(status, code, extra));
}

export function fieldErrors(error: ZodError): FieldError[] {
  return error.issues.map((i) => ({ field: i.path.join('.') || '(body)', message: i.message }));
}
