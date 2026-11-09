// messageFor (MSG-3): the UI shows the message for Problem.code, filled from Problem.params, never title/detail.
import { formatBytes, formatCount } from '@nimbus/format';
import { en, t, type MessageKey, type MessageParams } from '@nimbus/messages';
import type { Problem } from './generated/model';

type ProblemLike = Pick<Problem, 'code'> & { params?: Problem['params'] };

/** QUOTA_EXCEEDS_PLAN / QUOTA_BELOW_USAGE pick their message by params.resource and format max/used for it. */
function quotaMessage(code: 'QUOTA_EXCEEDS_PLAN' | 'QUOTA_BELOW_USAGE', params: MessageParams): string {
  const resource = params.resource === 'vms' ? 'vms' : 'storage';
  const format = resource === 'vms' ? (n: number) => formatCount(n) : (n: number) => formatBytes(n);
  const filled: MessageParams = { ...params };
  for (const name of ['max', 'used']) {
    const value = params[name];
    if (typeof value === 'number') filled[name] = format(value);
  }
  return t(`errors.${code}.${resource}`, filled);
}

export function messageFor(problem: ProblemLike): string {
  const params: MessageParams = { ...(problem.params ?? {}) };
  if (problem.code === 'QUOTA_EXCEEDS_PLAN' || problem.code === 'QUOTA_BELOW_USAGE') return quotaMessage(problem.code, params);
  const key = `errors.${problem.code}`;
  return key in en ? t(key as MessageKey, params) : t('errors.INTERNAL'); // unknown codes → INTERNAL
}
