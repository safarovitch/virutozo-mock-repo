// The one HTTP entry point for app code (AGENTS.md H2). Orval's generated functions call customFetch.
// - Same origin, base path /api, `credentials: 'same-origin'` set explicitly, no Authorization header (ADR-0005).
// - `X-Nimbus-Csrf: 1` on every mutation except reportVitals (NFR-SEC-6, D2-01).
// - Non-2xx responses throw ApiError (parsed application/problem+json); a 401 also calls onUnauthorized.
// - Success bodies are validated with the generated Zod schemas (API-5): throws in dev/test, logs in production.
import { createLogger } from '@nimbus/logger';
import type { Problem } from './generated/model';
import { responseSchemas } from './generated/response-schemas';
import { ProblemSchema } from './problem';

export interface ApiClientOptions {
  /** Called on every 401 (SPEC-SHL-1): the shell redirects; remotes publish session:expired. */
  onUnauthorized?: () => void;
  /** 'throw' in development and tests, 'log' in production builds. */
  responseValidation?: 'throw' | 'log' | 'off';
  /** Defaults to '/api' (same origin through the gateway or the dev proxy). */
  basePath?: string;
}

const log = createLogger('api-client');
let settings: Required<Omit<ApiClientOptions, 'onUnauthorized'>> & Pick<ApiClientOptions, 'onUnauthorized'> = {
  responseValidation: 'throw',
  basePath: '/api',
};

/** Each area calls this once at start-up. Areas bundle their own copy, so each configures its own. */
export function configureApiClient(options: ApiClientOptions): void {
  settings = { ...settings, ...options };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: Problem['code'];
  readonly params: NonNullable<Problem['params']>;
  readonly fieldErrors: NonNullable<Problem['errors']>;
  readonly problem: Problem;

  constructor(problem: Problem) {
    super(`${problem.status} ${problem.code}`);
    this.name = 'ApiError';
    this.problem = problem;
    this.status = problem.status;
    this.code = problem.code;
    this.params = problem.params ?? {};
    this.fieldErrors = problem.errors ?? [];
  }
}

export class ResponseValidationError extends Error {
  constructor(route: string, issues: unknown) {
    super(`Response for ${route} doesn't match the contract`);
    this.name = 'ResponseValidationError';
    this.cause = issues;
  }
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const ROUTES = Object.keys(responseSchemas).map((key) => {
  const [method, template] = key.split(' ') as [string, string];
  const pattern = new RegExp(`^${template.replace(/\{[^}]+\}/g, '[^/]+')}$`);
  return { key, method, pattern };
});

function routeKey(method: string, path: string): string | undefined {
  return ROUTES.find((r) => r.method === method && r.pattern.test(path))?.key;
}

function fallbackProblem(status: number): Problem {
  const code = status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'INTERNAL';
  return { title: `HTTP ${status}`, status, code };
}

export const customFetch = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
  const method = (options.method ?? 'GET').toUpperCase();
  const path = url.split('?')[0] ?? url;
  const headers = new Headers(options.headers);
  if (MUTATING.has(method) && !(method === 'POST' && path === '/rum')) headers.set('X-Nimbus-Csrf', '1');
  if (options.body !== undefined && !headers.has('content-type')) headers.set('content-type', 'application/json');

  const res = await fetch(`${settings.basePath}${url}`, { ...options, method, headers, credentials: 'same-origin' });
  const text = res.status === 204 ? '' : await res.text();
  const body: unknown = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    if (res.status === 401) settings.onUnauthorized?.();
    const parsed = ProblemSchema.safeParse(body);
    throw new ApiError(parsed.success ? parsed.data : fallbackProblem(res.status));
  }

  const key = routeKey(method, path);
  if (key && body !== undefined && settings.responseValidation !== 'off') {
    const result = responseSchemas[key]?.safeParse(body);
    if (result && !result.success) {
      if (settings.responseValidation === 'throw') throw new ResponseValidationError(key, result.error.issues);
      log.error('api.response_invalid', { route: key, issues: result.error.issues });
    }
  }

  return { data: body, status: res.status, headers: res.headers } as T;
};
