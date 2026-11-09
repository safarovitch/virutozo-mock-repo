import { z } from 'zod';

/** The remote manifest served at /remotes.json (SPEC.md §2.2, ADR-0001 R3). */
export const REMOTE_NAMES = ['tenants', 'storage', 'compute'] as const;
export type RemoteName = (typeof REMOTE_NAMES)[number];

const entryUrl = z.string().refine((v) => v.startsWith('/') || /^https?:\/\//.test(v), {
  message: 'must be an absolute URL or an absolute path',
});

export const ManifestSchema = z.strictObject({ tenants: entryUrl, storage: entryUrl, compute: entryUrl });
export type Manifest = z.infer<typeof ManifestSchema>;

/**
 * Fetches and validates the manifest. Throws on HTTP errors or an invalid shape, so the caller can show
 * an error instead of a blank page. This static config file is the one place the shell calls fetch()
 * directly: it isn't an API operation, so there's no generated client for it (AGENTS.md H2).
 */
export async function loadManifest(fetchImpl: typeof fetch = fetch): Promise<Manifest> {
  const res = await fetchImpl('/remotes.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Remote manifest request failed: HTTP ${res.status}`);
  return ManifestSchema.parse(await res.json());
}
