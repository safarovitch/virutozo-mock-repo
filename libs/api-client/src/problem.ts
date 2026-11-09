import { z } from 'zod';
import type { Problem } from './generated/model';
import { ErrorCode } from './generated/model';

/**
 * RFC 9457 problem details (API-2). Orval only generates Zod schemas for success responses, so this one is
 * hand-written; `satisfies` makes the compiler fail if it drifts from the generated `Problem` type.
 */
export const ProblemSchema = z.object({
  type: z.string().optional(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  code: z.enum(Object.values(ErrorCode) as [ErrorCode, ...ErrorCode[]]),
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  errors: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
}) satisfies z.ZodType<Problem>;
