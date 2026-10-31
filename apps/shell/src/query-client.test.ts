import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@nimbus/api-client';
import { createShellQueryClient } from './query-client';

describe('shell query client', () => {
  it("AC-SHL-3.2: a mutation refused with 403 asks for the errors.FORBIDDEN toast and changes nothing", async () => {
    const onForbidden = vi.fn();
    const client = createShellQueryClient(onForbidden);
    client.setQueryData(['tenants'], ['acme']);
    const mutation = client.getMutationCache().build(client, {
      mutationFn: async () => Promise.reject(new ApiError({ title: 'ignored server text', status: 403, code: 'FORBIDDEN' })),
    });
    await expect(mutation.execute(undefined)).rejects.toBeInstanceOf(ApiError);
    expect(onForbidden).toHaveBeenCalledWith("You don't have permission to do this.");
    expect(client.getQueryData(['tenants'])).toEqual(['acme']);
  });

  it('AC-SHL-3.2: other errors are left to the caller', async () => {
    const onForbidden = vi.fn();
    const client = createShellQueryClient(onForbidden);
    const mutation = client.getMutationCache().build(client, {
      mutationFn: async () => Promise.reject(new ApiError({ title: 'x', status: 409, code: 'TENANT_SUSPENDED' })),
    });
    await expect(mutation.execute(undefined)).rejects.toBeInstanceOf(ApiError);
    expect(onForbidden).not.toHaveBeenCalled();
  });
});
