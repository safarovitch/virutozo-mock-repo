// Errors a remote's boundary can't catch (event handlers, async work) are published as
// `remote:error { fatal: false }` (MF-6, D7-17). All remotes share one window, so a remote reports only
// errors whose stack points into its own code.
import type { ScopedBus } from './event-bus';

/**
 * Listens to `error` and `unhandledrejection` on `target` while a remote is mounted. `codeBase` is the URL
 * prefix of the remote's own bundle (`new URL(import.meta.env.BASE_URL, import.meta.url).href`).
 * Returns the cleanup for `unmount`.
 */
export function reportUncaughtErrors(remote: string, events: ScopedBus, codeBase: string, target: EventTarget = globalThis): () => void {
  const report = (reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    if (!error.stack?.includes(codeBase)) return;
    events.publish('remote:error', { remote, message: error.message, stack: error.stack, fatal: false });
  };
  const onError = (event: Event) => report((event as ErrorEvent).error);
  const onRejection = (event: Event) => report((event as PromiseRejectionEvent).reason);
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
}
