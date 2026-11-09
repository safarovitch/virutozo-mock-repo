// The shell's own QueryClient (MF-2: one per area). Remotes create theirs the same way on later days.
import { MutationCache, QueryClient } from '@tanstack/react-query';
import { ApiError, messageFor } from '@nimbus/api-client';

/**
 * AC-SHL-3.2, D3-14: a mutation the API refuses with 403 shows `errors.FORBIDDEN` as an error toast.
 * Mutations don't touch the cache before the server answers (no optimistic updates without a rollback,
 * R21), so a refused one changes nothing.
 */
export function createShellQueryClient(onForbidden: (message: string) => void): QueryClient {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError(error) {
        if (error instanceof ApiError && error.status === 403) onForbidden(messageFor(error.problem));
      },
    }),
    defaultOptions: { queries: { retry: false } },
  });
}
