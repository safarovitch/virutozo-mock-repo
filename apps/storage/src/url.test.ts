import { describe, expect, it } from 'vitest';
import { parsePath, toPath } from './url';

describe('storage URL', () => {
  it('AC-STO-3.1: admins keep a valid tenantId and other parameters', () => {
    expect(parsePath('/?tenantId=t_acme&x=1', true)).toEqual({ tenantId: 't_acme', other: [['x', '1']], needsCorrection: false });
    expect(toPath({ tenantId: 't_acme', other: [['x', '1']] })).toBe('/?tenantId=t_acme&x=1');
  });

  it('AC-STO-3.3: an invalid tenantId is dropped for admins; tenant roles never keep one', () => {
    expect(parsePath('/?tenantId=ACME!', true)).toEqual({ other: [], needsCorrection: true });
    expect(parsePath('/?tenantId=t_other', false)).toEqual({ other: [], needsCorrection: true });
    expect(parsePath('/', false)).toEqual({ other: [], needsCorrection: false });
    expect(toPath({})).toBe('/');
  });

  it('AC-STO-3.3: a path below /storage is corrected to the list', () => {
    expect(parsePath('/acme-assets?tenantId=t_acme', true)).toEqual({ tenantId: 't_acme', other: [], needsCorrection: true });
  });
});
