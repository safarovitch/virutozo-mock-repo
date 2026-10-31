import { loadRemote, registerRemotes } from '@module-federation/runtime';
import type { RemoteModule } from '@nimbus/mf-contract';
import type { Manifest, RemoteName } from './manifest';

/** Registers every remote from the manifest with the MF runtime (ESM remotes, ADR-0001). */
export function registerFromManifest(manifest: Manifest): void {
  registerRemotes(
    (Object.keys(manifest) as RemoteName[]).map((name) => ({ name, entry: manifest[name], type: 'module' as const })),
  );
}

/**
 * Loads `<name>/mount`. `retry` re-registers the remote with `force` first, so a failed entry isn't
 * served from the runtime's cache and Retry works without a page reload (AC-SHL-4.4).
 */
export async function loadRemoteModule(name: RemoteName, entry: string, retry = false): Promise<RemoteModule> {
  if (retry) registerRemotes([{ name, entry, type: 'module' }], { force: true });
  const mod = await loadRemote<RemoteModule>(`${name}/mount`);
  if (!mod || typeof mod.mount !== 'function') throw new Error(`Remote "${name}" doesn't expose mount()`);
  return mod;
}
