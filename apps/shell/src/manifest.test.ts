import { describe, expect, it } from 'vitest';
import { loadManifest } from './manifest';

const ok = { tenants: '/remotes/tenants/remoteEntry.js', storage: '/remotes/storage/remoteEntry.js', compute: 'http://localhost:4203/remoteEntry.js' };

function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
}

describe('loadManifest', () => {
  it('TECH-1: accepts a manifest with paths or absolute URLs for all three remotes', async () => {
    await expect(loadManifest(fakeFetch(200, ok))).resolves.toEqual(ok);
  });

  it('TECH-1: rejects a manifest with a missing remote', async () => {
    const partial = { tenants: ok.tenants, storage: ok.storage };
    await expect(loadManifest(fakeFetch(200, partial))).rejects.toThrow();
  });

  it('TECH-1: rejects an unknown remote name', async () => {
    await expect(loadManifest(fakeFetch(200, { ...ok, billing: '/remotes/billing/remoteEntry.js' }))).rejects.toThrow();
  });

  it('TECH-1: rejects a relative entry URL', async () => {
    await expect(loadManifest(fakeFetch(200, { ...ok, tenants: 'remoteEntry.js' }))).rejects.toThrow();
  });

  it('TECH-1: fails on an HTTP error instead of returning an empty manifest', async () => {
    await expect(loadManifest(fakeFetch(500, {}))).rejects.toThrow(/HTTP 500/);
  });
});
