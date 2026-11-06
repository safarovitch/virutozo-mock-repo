import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildGateway, cspFor } from './app.mjs';
import { parseConfig } from './config.mjs';

const HTML = { accept: 'text/html,application/xhtml+xml' };

/** Builds a fake shell + remotes + manifest on disk and returns a config pointing at it. */
function fixture(overrides = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'nimbus-gateway-'));
  const write = (rel, content) => {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), content);
  };
  write('shell/index.html', '<!doctype html><title>shell</title>');
  write('shell/assets/main.js', 'console.log("shell")');
  for (const n of ['tenants', 'storage', 'compute']) write(`${n}/remoteEntry.js`, `export const name = "${n}";`);
  const manifest = {
    tenants: '/remotes/tenants/remoteEntry.js',
    storage: '/remotes/storage/remoteEntry.js',
    compute: '/remotes/compute/remoteEntry.js',
  };
  write('remotes.gateway.json', JSON.stringify(manifest));
  return {
    mode: 'e2e',
    port: 0,
    tls: null,
    mockApiUrl: 'http://127.0.0.1:1',
    failRemotes: new Set(),
    testEndpoints: true,
    shellDist: path.join(dir, 'shell'),
    remoteDists: { tenants: path.join(dir, 'tenants'), storage: path.join(dir, 'storage'), compute: path.join(dir, 'compute') },
    manifestPath: path.join(dir, 'remotes.gateway.json'),
    ...overrides,
  };
}

describe('parseConfig', () => {
  it('TECH-1: refuses to start without NIMBUS_MODE', () => {
    expect(() => parseConfig({})).toThrow(/NIMBUS_MODE/);
  });

  it('TECH-1: refuses an invalid NIMBUS_MODE', () => {
    expect(() => parseConfig({ NIMBUS_MODE: 'production' })).toThrow(/NIMBUS_MODE/);
  });

  it('TECH-1: test endpoints exist only in dev and e2e', () => {
    expect(parseConfig({ NIMBUS_MODE: 'dev' }).testEndpoints).toBe(true);
    expect(parseConfig({ NIMBUS_MODE: 'e2e' }).testEndpoints).toBe(true);
    expect(parseConfig({ NIMBUS_MODE: 'demo' }).testEndpoints).toBe(false);
  });

  it('BUG-5: e2e and dev serve the e2e builds (dist-e2e); demo serves the production builds (dist)', () => {
    const e2e = parseConfig({ NIMBUS_MODE: 'e2e' });
    expect(e2e.shellDist).toMatch(/apps\/shell\/dist-e2e$/);
    expect(e2e.remoteDists.storage).toMatch(/apps\/storage\/dist-e2e$/);
    expect(parseConfig({ NIMBUS_MODE: 'dev' }).shellDist).toMatch(/dist-e2e$/);
    const demo = parseConfig({ NIMBUS_MODE: 'demo' });
    expect(demo.shellDist).toMatch(/apps\/shell\/dist$/);
    expect(demo.remoteDists.compute).toMatch(/apps\/compute\/dist$/);
  });

  it('TECH-1: defaults to port 8080, and TLS=1 needs a certificate and key', () => {
    expect(parseConfig({ NIMBUS_MODE: 'e2e' }).port).toBe(8080);
    expect(() => parseConfig({ NIMBUS_MODE: 'e2e', TLS: '1' })).toThrow(/TLS_CERT/);
    expect(parseConfig({ NIMBUS_MODE: 'e2e', TLS: '1', TLS_CERT: 'c', TLS_KEY: 'k' }).port).toBe(8443);
  });

  it('TECH-1: reads its port from GATEWAY_PORT, never from PORT', () => {
    expect(parseConfig({ NIMBUS_MODE: 'e2e', GATEWAY_PORT: '8090' }).port).toBe(8090);
    expect(parseConfig({ NIMBUS_MODE: 'e2e', PORT: '4000' }).port).toBe(8080);
    expect(() => parseConfig({ NIMBUS_MODE: 'e2e', GATEWAY_PORT: 'http' })).toThrow();
  });

  it('TECH-1: FAIL_REMOTES accepts known remote names only', () => {
    expect([...parseConfig({ NIMBUS_MODE: 'demo', FAIL_REMOTES: 'storage, compute' }).failRemotes]).toEqual(['storage', 'compute']);
    expect(() => parseConfig({ NIMBUS_MODE: 'demo', FAIL_REMOTES: 'billing' })).toThrow();
  });
});

describe('gateway routing (SPEC.md §2.2)', () => {
  let upstream;
  let app;

  beforeAll(async () => {
    upstream = Fastify();
    upstream.get('/api/me', async () => ({ from: 'mock-api' }));
    await upstream.listen({ port: 0, host: '127.0.0.1' });
    app = await buildGateway(fixture({ mockApiUrl: `http://127.0.0.1:${upstream.server.address().port}` }));
  });

  afterAll(async () => {
    await app.close();
    await upstream.close();
  });

  it('TECH-1: proxies /api/* to mock-api', async () => {
    const res = await app.inject({ url: '/api/me' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ from: 'mock-api' });
  });

  it('TECH-1: serves the gateway manifest at /remotes.json without caching', async () => {
    const res = await app.inject({ url: '/remotes.json' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.json().storage).toBe('/remotes/storage/remoteEntry.js');
  });

  it("TECH-1: serves a remote's files under /remotes/<name>/", async () => {
    const res = await app.inject({ url: '/remotes/storage/remoteEntry.js' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('storage');
  });

  it('AC-SHL-1.14: a missing file under /remotes/storage/ returns 404, not index.html', async () => {
    const res = await app.inject({ url: '/remotes/storage/missing.js', headers: HTML });
    expect(res.statusCode).toBe(404);
    expect(res.body).not.toContain('<title>shell</title>');
  });

  it("TECH-1: serves a real file from the shell's build", async () => {
    const res = await app.inject({ url: '/assets/main.js' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('shell');
  });

  it('TECH-1: a deep link that accepts HTML gets index.html with 200 and the CSP header', async () => {
    const res = await app.inject({ url: '/tenants/t_acme?tab=quotas', headers: HTML });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<title>shell</title>');
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
  });

  it('TECH-1: GET / serves the shell index.html with the CSP header', async () => {
    const res = await app.inject({ url: '/', headers: HTML });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<title>shell</title>');
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
  });

  it("TECH-1: a non-HTML request for an unknown path is 404", async () => {
    const res = await app.inject({ url: '/nope.json', headers: { accept: 'application/json' } });
    expect(res.statusCode).toBe(404);
  });

  it('TECH-1: /__test/fail-remotes switches a remote to 503 and back without a restart', async () => {
    expect((await app.inject({ method: 'POST', url: '/__test/fail-remotes', payload: { remotes: ['storage'] } })).statusCode).toBe(204);
    expect((await app.inject({ url: '/remotes/storage/remoteEntry.js' })).statusCode).toBe(503);
    expect((await app.inject({ url: '/remotes/tenants/remoteEntry.js' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/__test/fail-remotes', payload: { remotes: [] } })).statusCode).toBe(204);
    expect((await app.inject({ url: '/remotes/storage/remoteEntry.js' })).statusCode).toBe(200);
  });
});

describe('WebSocket proxy (/api/events)', () => {
  it('TECH-1: forwards the cookie and the browser Origin on the upgrade, so mock-api can check both', async () => {
    const { default: websocket } = await import('@fastify/websocket');
    const upstream = Fastify();
    await upstream.register(websocket);
    upstream.get('/api/events', { websocket: true }, (socket, req) => {
      socket.send(JSON.stringify({ cookie: req.headers.cookie ?? null, origin: req.headers.origin ?? null }));
    });
    await upstream.listen({ port: 0, host: '127.0.0.1' });
    const gateway = await buildGateway(fixture({ mockApiUrl: `http://127.0.0.1:${upstream.server.address().port}` }));
    await gateway.listen({ port: 0, host: '127.0.0.1' });

    const ws = new WebSocket(`ws://127.0.0.1:${gateway.server.address().port}/api/events`, {
      headers: { cookie: 'nimbus_session=abc', origin: 'http://localhost:8080' },
    });
    const received = await new Promise((resolve, reject) => {
      ws.onmessage = (m) => resolve(JSON.parse(String(m.data)));
      ws.onerror = reject;
    });
    expect(received).toEqual({ cookie: 'nimbus_session=abc', origin: 'http://localhost:8080' });
    ws.close();
    await gateway.close();
    await upstream.close();
  });
});

describe('gateway modes', () => {
  it('TECH-1: FAIL_REMOTES makes that remote return 503', async () => {
    const app = await buildGateway(fixture({ failRemotes: new Set(['storage']), mode: 'demo', testEndpoints: false }));
    expect((await app.inject({ url: '/remotes/storage/remoteEntry.js' })).statusCode).toBe(503);
    await app.close();
  });

  it('TECH-1: in demo mode the test endpoint does not exist', async () => {
    const app = await buildGateway(fixture({ mode: 'demo', testEndpoints: false }));
    const res = await app.inject({ method: 'POST', url: '/__test/fail-remotes', payload: { remotes: ['storage'] } });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('TECH-1: the CSP script-src comes from the manifest (NFR-SEC-1)', () => {
    expect(cspFor({ a: '/remotes/a/remoteEntry.js' })).toContain("script-src 'self';");
    expect(cspFor({ a: 'http://localhost:4201/remoteEntry.js' })).toContain("script-src 'self' http://localhost:4201;");
  });
});
