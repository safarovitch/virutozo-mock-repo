import { describe, expect, it } from 'vitest';
import { bucketNameError } from './validate';

describe('bucket names', () => {
  it('AC-STO-2.1: uppercase, underscores, wrong length, edges and ".." are invalid', () => {
    for (const name of ['My_Bucket', 'ab', 'a'.repeat(64), '-abc', 'abc-', 'a..b', 'ABC']) expect(bucketNameError(name)).toBe('storage.bucketNameInvalid');
    for (const name of ['abc', 'acme-logs-2026', 'a.b-c', 'a'.repeat(63)]) expect(bucketNameError(name)).toBeUndefined();
  });

  it('AC-STO-2.2: an IPv4-shaped name is rejected as an IP address', () => {
    expect(bucketNameError('192.168.1.1')).toBe('storage.bucketNameIp');
    expect(bucketNameError('192.168.1')).toBeUndefined();
  });
});
