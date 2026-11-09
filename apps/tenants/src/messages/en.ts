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
  // ── Wizard (SPEC-TEN-2, D7-22) ──
  'tenants.nameInvalid': 'Use lowercase letters, numbers and hyphens.', // draft
  'tenants.discardChanges': 'Discard changes?', // draft
  'tenants.discard': 'Discard', // draft
  'tenants.toast.created': 'Tenant {name} created.', // draft
  'tenants.wizard.title': 'Create tenant', // draft
  'tenants.wizard.steps.details': 'Details', // draft
  'tenants.wizard.steps.plan': 'Plan & quotas', // draft
  'tenants.wizard.steps.review': 'Review', // draft
  'tenants.fields.name': 'Name', // draft
  'tenants.fields.displayName': 'Display name', // draft
  'tenants.fields.plan': 'Plan', // draft
  'tenants.wizard.displayNameHint': 'Optional. Defaults to the name.', // draft
  'tenants.wizard.edit': 'Edit {step}', // draft
  'tenants.wizard.planLimits': 'Up to {storage} and {vms} VMs', // draft
  'tenants.wizard.planPrice': '{perGiB} per GiB · {perVcpu} per vCPU a month', // draft
  'tenants.wizard.noPlans': 'No plans are available.', // draft
  'validation.required': 'Enter a value.', // draft
  'validation.email': 'Enter a valid email address.', // draft
  'validation.wholeNumber': 'Enter a whole number.', // draft
  'validation.min': 'Enter {min} or more.', // draft
  // ── Suspend / resume (SPEC-TEN-4, D7-02, D7-03, D7-13) ──
  'tenants.menu.suspend': 'Suspend', // draft
  'tenants.menu.resume': 'Resume', // draft
  'tenants.suspend.title': 'Suspend {name}?', // draft
  'tenants.suspend.body': "Users of {displayName} can't start, stop or change VMs, buckets or quotas until the tenant is resumed. Running VMs keep running.", // draft
  'tenants.suspend.confirm': 'Suspend tenant', // draft
  'tenants.resume.title': 'Resume {name}?', // draft
  'tenants.resume.body': 'Users of {displayName} can change VMs, buckets and quotas again.', // draft
  'tenants.resume.confirm': 'Resume tenant', // draft
  'tenants.suspendUnavailable': 'Only active tenants can be suspended.', // draft
  'tenants.lifecycleInProgress': 'Wait for the current operation on this tenant to finish.', // draft (A7-01)
  'tenants.toast.suspended': 'Tenant {name} suspended.', // draft
  'tenants.toast.resumed': 'Tenant {name} resumed.', // draft
} as const;

export const { t, tp } = createTranslator({ ...shared, ...tenantsEn });
