import { describe, expect, it } from 'vitest';
import { parsePath, toPath } from './url';

describe('compute URL (url-conventions)', () => {
  it('AC-CMP-4.7: tenant roles ignore tenantId and get a correction that removes it', () => {
    expect(parsePath('/?tenantId=t_other', false)).toEqual({ vmId: undefined, tenantId: undefined, other: [], needsCorrection: true });
    expect(toPath(parsePath('/vm_01?tenantId=t_other&x=1', false))).toBe('/vm_01?x=1');
  });

  it('AC-CMP-5.4: admins keep a valid tenantId; an invalid one is treated as missing and removed', () => {
    expect(parsePath('/vm_01?tenantId=t_acme', true)).toMatchObject({ vmId: 'vm_01', tenantId: 't_acme', needsCorrection: false });
    expect(parsePath('/?tenantId=ACME!', true)).toMatchObject({ tenantId: undefined, needsCorrection: true });
  });

  it('AC-CMP-5.1: unknown parameters are kept, in a stable order after tenantId', () => {
    const url = parsePath('/vm_02?utm=a&tenantId=t_acme', true);
    expect(toPath(url)).toBe('/vm_02?tenantId=t_acme&utm=a');
    expect(toPath({ tenantId: 't_acme' })).toBe('/?tenantId=t_acme');
    expect(toPath({})).toBe('/');
  });
});
