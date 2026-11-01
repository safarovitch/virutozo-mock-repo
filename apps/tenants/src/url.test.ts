import { describe, expect, it } from 'vitest';
import { columnToSort, listParams, parsePath, sortToColumn, toPath } from './url';

describe('tenants URL state', () => {
  it('AC-TEN-1.4: /tenants?status=suspended&sort=-createdAt parses into the filter and sort', () => {
    const url = parsePath('/?status=suspended&sort=-createdAt');
    expect(url.list).toEqual({ status: 'suspended', sort: '-createdAt' });
    expect(url.needsCorrection).toBe(false);
    expect(listParams(url.list)).toEqual({ status: 'suspended', sort: '-createdAt', limit: 100 });
  });

  it('AC-TEN-1.4: invalid filter values are dropped and flagged for a replace (D5-06)', () => {
    const url = parsePath('/?status=bogus&sort=foo&planId=p_nope&q=%20%20&keep=1', new Set(['p_business']));
    expect(url.list).toEqual({ sort: 'name' });
    expect(url.needsCorrection).toBe(true);
    expect(toPath(url)).toBe('/?keep=1'); // unknown parameters are kept (url-conventions)
  });

  it('AC-TEN-1.3: sort values map to columns and back, with name as the default left out of the URL', () => {
    expect(sortToColumn('-name')).toEqual({ id: 'name', desc: true });
    expect(columnToSort('storageUsedBytes', true)).toBe('-storageUsedBytes');
    expect(toPath({ list: { sort: 'name' } })).toBe('/');
    expect(toPath({ list: { sort: '-name' } })).toBe('/?sort=-name');
    expect(parsePath('/?sort=name').needsCorrection).toBe(true);
  });

  it('AC-TEN-3.13: an unknown tab is dropped and the drawer URL loses it', () => {
    const url = parsePath('/t_acme?tab=bogus');
    expect(url.tenantId).toBe('t_acme');
    expect(url.tab).toBe('overview');
    expect(url.needsCorrection).toBe(true);
    expect(toPath(url)).toBe('/t_acme');
  });

  it('AC-TEN-1.4: list filters stay in the URL while the drawer is open (url-conventions)', () => {
    const url = parsePath('/t_acme?status=active&sort=-createdAt&tab=quotas');
    expect(url.needsCorrection).toBe(false);
    expect(toPath(url)).toBe('/t_acme?status=active&sort=-createdAt&tab=quotas');
    expect(toPath({ list: url.list, other: url.other })).toBe('/?status=active&sort=-createdAt');
  });
});
