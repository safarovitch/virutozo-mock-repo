// The tenants area's own catalogue (MSG-1), merged over the shared one. Wording: specs/mock-data.md §10.
import { createTranslator, en as shared } from '@nimbus/messages';

export const tenantsEn = {
  'tenants.title': 'Tenants', // draft
  'tenants.list.count': 'Showing {shown} of {total} tenants',
  'tenants.empty': 'No tenants yet', // draft
  'tenants.noMatches': 'No tenants match your filters', // draft
  'tenants.clearFilters': 'Clear filters', // draft
  'tenants.create': 'Create tenant', // draft
  'tenants.search': 'Search tenants', // draft
  'tenants.filter.status': 'Status', // draft
  'tenants.filter.plan': 'Plan', // draft
  'tenants.filter.all': 'All', // draft
  'tenants.columns.name': 'Name', // draft
  'tenants.columns.displayName': 'Display name', // draft
  'tenants.columns.status': 'Status', // draft
  'tenants.columns.plan': 'Plan', // draft
  'tenants.columns.storage': 'Storage', // draft
  'tenants.columns.vmQuota': 'VM quota', // draft
  'tenants.columns.created': 'Created', // draft
  'tenants.menu.label': 'Actions for {name}', // draft
  'tenants.menu.open': 'Open details', // draft
  'tenants.menu.viewVms': 'View VMs', // draft
  'tenants.menu.viewBuckets': 'View buckets', // draft
  'tenants.drawer.tabs.overview': 'Overview', // draft
  'tenants.drawer.tabs.quotas': 'Quotas', // draft
  'tenants.drawer.tabs.activity': 'Activity', // draft
  'tenants.fields.id': 'ID', // draft
  'tenants.fields.reseller': 'Reseller', // draft
  'tenants.fields.adminEmail': 'Admin email', // draft
  'tenants.quotas.storage': 'Storage quota (GiB)', // draft
  'tenants.quotas.vms': 'VM quota', // draft
  'tenants.quotas.save': 'Save quotas', // draft
  'tenants.quotas.saved': 'Quotas updated.', // draft
  'tenants.activity.empty': 'No activity in the last 24 hours.', // draft
  'tenants.storageUsage': '{used} of {quota}', // draft
  'tenants.vmUsage': '{count} of {quota}', // draft
} as const;

export const { t, tp } = createTranslator({ ...shared, ...tenantsEn });
