import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, ResponseValidationError, configureApiClient, customFetch } from './http';
import * as react from './react';

type Call = { url: string; init: RequestInit & { headers: Headers } };
const calls: Call[] = [];

function respond(status: number, body?: unknown, contentType = 'application/json') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit & { headers: Headers }) => {
      calls.push({ url, init });
      return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': contentType } });
    }),
  );
}

const tenantPage = { items: [], nextCursor: null, total: 0 };
const problem = (code: string, status: number, extra: object = {}) => ({ title: code, status, code, ...extra });

describe('customFetch', () => {
  beforeEach(() => {
    calls.length = 0;
    configureApiClient({ onUnauthorized: undefined, responseValidation: 'throw', basePath: '/api' });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('TECH-2: calls /api on the same origin with credentials same-origin and no Authorization header', async () => {
    respond(200, tenantPage);
    const res = await customFetch<{ data: unknown; status: number }>('/tenants?limit=10', { method: 'GET' });
    expect(res).toMatchObject({ data: tenantPage, status: 200 });
    expect(calls[0]?.url).toBe('/api/tenants?limit=10');
    expect(calls[0]?.init.credentials).toBe('same-origin');
    expect(calls[0]?.init.headers.has('authorization')).toBe(false);
  });

  it('NFR-SEC-6: sends X-Nimbus-Csrf on mutations only, and not on reportVitals', async () => {
    respond(204);
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) await customFetch('/buckets/x', { method });
    await customFetch('/rum', { method: 'POST', body: '[]' });
    respond(200, tenantPage);
    await customFetch('/tenants', { method: 'GET' });
    const csrf = calls.map((c) => [c.init.method, c.url, c.init.headers.get('X-Nimbus-Csrf')]);
    expect(csrf).toEqual([
      ['POST', '/api/buckets/x', '1'],
      ['PUT', '/api/buckets/x', '1'],
      ['PATCH', '/api/buckets/x', '1'],
      ['DELETE', '/api/buckets/x', '1'],
      ['POST', '/api/rum', null],
      ['GET', '/api/tenants', null],
    ]);
  });

  it('TECH-2: a 401 calls onUnauthorized and throws ApiError UNAUTHENTICATED', async () => {
    const onUnauthorized = vi.fn();
    configureApiClient({ onUnauthorized });
    respond(401, problem('UNAUTHENTICATED', 401), 'application/problem+json');
    await expect(customFetch('/me', { method: 'GET' })).rejects.toMatchObject({ code: 'UNAUTHENTICATED', status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('TECH-2: parses application/problem+json into ApiError with code, params and fieldErrors', async () => {
    respond(
      422,
      problem('QUOTA_EXCEEDS_PLAN', 422, {
        params: { resource: 'storage', plan: 'Starter', max: 107374182400 },
        errors: [{ field: 'storageQuotaBytes', message: 'too big' }],
      }),
      'application/problem+json',
    );
    const error = await customFetch('/tenants', { method: 'POST', body: '{}' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: 'QUOTA_EXCEEDS_PLAN',
      params: { resource: 'storage', plan: 'Starter', max: 107374182400 },
      fieldErrors: [{ field: 'storageQuotaBytes', message: 'too big' }],
    });
  });

  it("TECH-2: a non-problem error body still becomes an ApiError for the status", async () => {
    respond(503, { nope: true });
    await expect(customFetch('/tenants', { method: 'GET' })).rejects.toMatchObject({ code: 'INTERNAL', status: 503 });
  });

  it("API-5: a success body that doesn't match the contract throws in dev/test", async () => {
    respond(200, { items: 'not-an-array', nextCursor: null, total: 0 });
    await expect(customFetch('/tenants', { method: 'GET' })).rejects.toBeInstanceOf(ResponseValidationError);
  });

  it('API-5: in production mode an invalid body is logged, not thrown', async () => {
    configureApiClient({ responseValidation: 'log' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    respond(200, { items: 'not-an-array', nextCursor: null, total: 0 });
    await expect(customFetch('/tenants', { method: 'GET' })).resolves.toMatchObject({ status: 200 });
    expect(console.error).toHaveBeenCalledWith('[nimbus][api-client] api.response_invalid', expect.anything());
  });

  it('API-5: validation matches templated paths (GET /tenants/{tenantId})', async () => {
    respond(200, { id: 't_acme' });
    await expect(customFetch('/tenants/t_acme', { method: 'GET' })).rejects.toBeInstanceOf(ResponseValidationError);
  });
});

describe('generated client', () => {
  it('TECH-2: the WebSocket operation has no generated fetch hook (D2-04)', () => {
    expect(Object.keys(react).some((k) => /events/i.test(k))).toBe(false);
  });

  it('TECH-2: mutating hooks take no CSRF header argument (D2-01)', () => {
    expect(react.createBucket.length).toBeLessThanOrEqual(2); // (body, options)
  });
});
