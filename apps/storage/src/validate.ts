// Bucket name rules (SPEC-STO-2, D8-13), checked in this order before any request. The pattern and
// lengths are the contract's `BucketName` (Orval's Zod constants); the server checks the same.
import { createBucketBodyNameMax, createBucketBodyNameMin, createBucketBodyNameRegExp } from '@nimbus/api-client/zod';

export type BucketNameError = 'storage.bucketNameInvalid' | 'storage.bucketNameIp';

export function bucketNameError(name: string): BucketNameError | undefined {
  if (name.length < createBucketBodyNameMin || name.length > createBucketBodyNameMax || !createBucketBodyNameRegExp.test(name) || name.includes('..'))
    return 'storage.bucketNameInvalid';
  if (/^\d+\.\d+\.\d+\.\d+$/.test(name)) return 'storage.bucketNameIp';
  return undefined;
}
