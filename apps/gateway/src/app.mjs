// Same-origin gateway (ADR-0005). Resolution order (SPEC.md §2.2):
// 1. /api/*            → proxy to mock-api (including the WebSocket upgrade)
// 2. /remotes.json     → config/remotes.gateway.json
// 3. /remotes/<name>/* → that remote's static files; a missing file is 404, never a fallback
// 4. a real file in the shell's build
// 5. any other GET/HEAD accepting text/html → the shell's index.html (200)
// 6. anything else → 404
import { readFileSync } from 'node:fs';
import path from 'node:path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyHttpProxy from '@fastify/http-proxy';
import { REMOTE_NAMES } from './config.mjs';

/**
 * CSP for HTML responses (NFR-SEC-1). script-src is generated from the remote manifest, so the two
 * can't drift apart: same-origin paths are covered by 'self', absolute URLs add their origin.
 * @param {Record<string, string>} manifest
 */
export function cspFor(manifest) {
  const origins = [...new Set(Object.values(manifest).filter((u) => /^https?:\/\//.test(u)).map((u) => new URL(u).origin))];
  return [
    "default-src 'self'",
    ['script-src', "'self'", ...origins].join(' '),
    "connect-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
  ].join('; ');
}

/** @param {import('./config.mjs').GatewayConfig} config */
export async function buildGateway(config) {
  const app = Fastify({
    logger: false,
    ...(config.tls ? { https: { cert: readFileSync(config.tls.cert), key: readFileSync(config.tls.key) } } : {}),
  });
  const manifestJson = readFileSync(config.manifestPath, 'utf8');
  const csp = cspFor(JSON.parse(manifestJson));
  const failing = new Set(config.failRemotes);

  app.addHook('onSend', async (_req, reply, payload) => {
    if (String(reply.getHeader('content-type') ?? '').startsWith('text/html')) {
      reply.header('content-security-policy', csp);
    }
    return payload;
  });

  // Failing remotes: 503 for everything under /remotes/<name>/ (FAIL_REMOTES, /__test/fail-remotes).
  app.addHook('onRequest', async (req, reply) => {
    const m = /^\/remotes\/([\w-]+)\//.exec(req.url);
    if (m && m[1] && failing.has(m[1])) reply.code(503).send({ error: `remote ${m[1]} is switched off` });
  });

  // 1. API
  await app.register(fastifyHttpProxy, {
    upstream: config.mockApiUrl,
    prefix: '/api',
    rewritePrefix: '/api',
    websocket: true,
    // BUG-7: mock-api trusts X-Forwarded-For from this gateway (rate limits per client IP), so the gateway
    // sets it from the socket and drops whatever the client sent.
    replyOptions: {
      rewriteRequestHeaders: (request, headers) => ({ ...headers, 'x-forwarded-for': request.socket.remoteAddress ?? request.ip }),
    },
    // The proxy opens its own upstream socket and by default forwards only `cookie`. mock-api also checks
    // `Origin` on the upgrade (NFR-SEC-6, close 4403), so forward the browser's Origin too.
    wsClientOptions: {
      rewriteRequestHeaders: (/** @type {Record<string, string>} */ headers, /** @type {import('fastify').FastifyRequest} */ request) => ({
        ...headers,
        ...(request.headers.cookie ? { cookie: request.headers.cookie } : {}),
        ...(request.headers.origin ? { origin: request.headers.origin } : {}),
        'x-forwarded-for': request.socket.remoteAddress ?? request.ip, // BUG-7
      }),
    },
  });

  // 2. Manifest
  app.get('/remotes.json', async (_req, reply) =>
    reply.header('cache-control', 'no-store').type('application/json').send(manifestJson),
  );

  // 3. Remotes
  for (const [i, name] of REMOTE_NAMES.entries()) {
    await app.register(fastifyStatic, {
      root: path.resolve(/** @type {string} */ (config.remoteDists[name])),
      prefix: `/remotes/${name}/`,
      decorateReply: i === 0,
      index: false,
    });
  }

  // 4. Shell
  await app.register(fastifyStatic, {
    root: path.resolve(config.shellDist),
    prefix: '/',
    decorateReply: false,
    index: 'index.html', // GET / is a directory request; without this @fastify/static answers 403
    wildcard: true,
  });

  // Test endpoint: only in dev and e2e (NIMBUS_MODE), never in demo.
  if (config.testEndpoints) {
    app.post('/__test/fail-remotes', async (req, reply) => {
      const body = /** @type {{ remotes?: unknown }} */ (req.body ?? {});
      const names = Array.isArray(body.remotes) ? body.remotes.filter((n) => REMOTE_NAMES.includes(n)) : null;
      if (!names) return reply.code(422).send({ error: 'body must be { "remotes": string[] }' });
      failing.clear();
      for (const n of names) failing.add(n);
      return reply.code(204).send();
    });
  }

  // 5 and 6. SPA fallback for HTML navigations; everything else is a plain 404.
  const indexPath = path.join(path.resolve(config.shellDist), 'index.html');
  app.setNotFoundHandler(async (req, reply) => {
    const accept = String(req.headers.accept ?? '');
    const isPage = (req.method === 'GET' || req.method === 'HEAD') && accept.includes('text/html');
    if (isPage && !req.url.startsWith('/remotes/') && !req.url.startsWith('/api/') && !req.url.startsWith('/__test/')) {
      return reply.code(200).type('text/html; charset=utf-8').send(readFileSync(indexPath));
    }
    return reply.code(404).send({ error: 'Not found' });
  });

  return app;
}
