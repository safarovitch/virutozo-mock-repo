// Test helpers for mock-api integration tests. Every response is validated against the contract:
// success bodies with the generated Zod schemas, errors with ProblemSchema (Day 2 "contract test").
import type { Role, ServerEvent } from '@nimbus/api-client/model';
import { ProblemSchema, responseSchemas } from '@nimbus/api-client';
import { buildMockApi, type MockApi } from './app';
import { parseConfig, type MockApiConfig } from './config';

export const ORIGIN = 'http://localhost:8080';

export async function createApp(overrides: Partial<MockApiConfig> = {}): Promise<MockApi> {
  return buildMockApi({ ...parseConfig({ NIMBUS_MODE: 'e2e' }), timeScale: 0.01, ...overrides });
}

const ROUTES = Object.keys(responseSchemas).map((key) => {
  const [method, template] = key.split(' ') as [string, string];
  return { key, method, pattern: new RegExp(`^${template.replace(/\{[^}]+\}/g, '[^/]+')}$`) };
});

export interface CallOptions {
  method?: string;
  url: string;
  cookie?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** Mutations get Origin + X-Nimbus-Csrf unless set to false. */
  csrf?: boolean;
}

export async function call(app: MockApi, o: CallOptions) {
  const method = o.method ?? 'GET';
  const headers: Record<string, string> = { ...(o.cookie ? { cookie: o.cookie } : {}) };
  if (method !== 'GET' && o.csrf !== false) Object.assign(headers, { origin: ORIGIN, 'x-nimbus-csrf': '1' });
  Object.assign(headers, o.headers ?? {});
  const res = await app.inject({ method: method as 'GET', url: o.url, headers, ...(o.body !== undefined ? { payload: o.body as object } : {}) });
  const json = res.body ? safeJson(res.body) : undefined;
  validateAgainstContract(method, o.url, res.statusCode, res.headers['content-type'], json);
  return { status: res.statusCode, headers: res.headers, json: json as never };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Throws if the response doesn't match the contract. Test endpoints (/api/__test/) aren't in the contract. */
export function validateAgainstContract(method: string, url: string, status: number, contentType: string | string[] | undefined, json: unknown) {
  const path = (url.split('?')[0] ?? url).replace(/^\/api/, '');
  if (path.startsWith('/__test/')) return;
  if (status >= 400) {
    if (!String(contentType).startsWith('application/problem+json')) throw new Error(`${method} ${url} → ${status} without problem+json`);
    ProblemSchema.parse(json);
    return;
  }
  if (status === 204) return;
  const route = ROUTES.find((r) => r.method === method && r.pattern.test(path));
  if (!route) throw new Error(`No contract schema for ${method} ${path}`);
  responseSchemas[route.key]?.parse(json);
}

export async function login(app: MockApi, role: Role): Promise<string> {
  const res = await call(app, { method: 'POST', url: '/api/login', body: { role } });
  if (res.status !== 200) throw new Error(`login failed: ${res.status}`);
  const cookie = String(res.headers['set-cookie']).split(';')[0] as string;
  return cookie;
}

/** Opens /api/events and collects parsed messages and the close code. */
export async function openEvents(app: MockApi, cookie: string, origin = ORIGIN) {
  const messages: ServerEvent[] = [];
  let closeCode: number | undefined;
  const ws = await app.injectWS('/api/events', { headers: { cookie, origin } });
  const closed = new Promise<number>((resolve) => ws.on('close', (code: number) => resolve((closeCode = code))));
  ws.on('message', (data: Buffer) => messages.push(JSON.parse(data.toString()) as ServerEvent));
  return { ws, messages, closed, closeCode: () => closeCode };
}

export const until = async (check: () => boolean, timeoutMs = 5000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting for condition');
    await new Promise((r) => setTimeout(r, 5));
  }
};
