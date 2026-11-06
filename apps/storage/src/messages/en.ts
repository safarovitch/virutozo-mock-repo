// The storage area's own catalogue (MSG-1), merged over the shared one. Wording: specs/mock-data.md §10.
import { createTranslator, en as shared } from '@nimbus/messages';

export const storageEn = {
  'storage.title': 'Buckets', // draft (table label)
  'storage.usageTitle': 'Storage usage', // draft (D8-10)
  'storage.usage': '{used} of {quota}', // draft (D8-10)
  'storage.usagePercent': '{percent}% of quota used', // draft
  'storage.empty': 'No buckets yet.', // draft (D8-11)
  'storage.loadMore': 'Load more', // draft
  'storage.chooseTenant': 'Choose a tenant to see its buckets.', // draft
  'storage.columns.name': 'Name', // draft
  'storage.columns.size': 'Size', // draft
  'storage.columns.objects': 'Objects', // draft
  'storage.columns.versioning': 'Versioning', // draft
  'storage.columns.created': 'Created', // draft
  'storage.versioning.on': 'On', // draft
  'storage.versioning.off': 'Off', // draft
  'storage.fields.name': 'Name', // draft
  'storage.fields.versioning': 'Versioning', // draft
  'storage.bucketNameInvalid': 'Use 3–63 lowercase letters, numbers, dots and hyphens.', // draft
  'storage.bucketNameIp': "Bucket names can't look like IP addresses.", // draft
  'storage.create.title': 'Create bucket', // draft
  'storage.create.confirm': 'Create bucket', // draft
  'storage.delete.title': 'Delete {name}?', // draft
  'storage.delete.body': "This can't be undone.", // draft
  'storage.delete.confirm': 'Delete bucket', // draft
  'storage.toast.created': 'Bucket {name} created.', // draft
  'storage.toast.deleted': 'Bucket {name} deleted.', // draft
  'menu.deleteBucket': 'Delete', // draft
  'storage.deleteFor': 'Delete {name}', // draft (accessible name of a row's Delete)
} as const;

export const { t, tp } = createTranslator({ ...shared, ...storageEn });
