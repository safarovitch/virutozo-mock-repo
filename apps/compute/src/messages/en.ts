// The compute area's own catalogue (MSG-1), merged over the shared one. Wording: specs/mock-data.md §10.
import { createTranslator, en as shared } from '@nimbus/messages';

export const computeEn = {
  'compute.title': 'Virtual machines', // draft
  'compute.columns.name': 'Name', // draft
  'compute.columns.status': 'Status', // draft
  'compute.columns.vcpus': 'vCPU', // draft
  'compute.columns.memory': 'Memory', // draft
  'compute.columns.ip': 'IP', // draft
  'compute.columns.actions': 'Actions', // draft
  'status.vm.running': 'Running', // draft
  'status.vm.stopped': 'Stopped', // draft
  'status.vm.starting': 'Starting', // draft
  'status.vm.stopping': 'Stopping', // draft
  'status.vm.rebooting': 'Rebooting', // draft
  'status.vm.error': 'Error', // draft
  'compute.actions.start': 'Start', // draft
  'compute.actions.stop': 'Stop', // draft
  'compute.actions.reboot': 'Reboot', // draft
  'compute.actionsFor': 'Actions for {name}', // draft
  'compute.confirmStop.title': 'Stop {name}?', // draft
  'compute.confirmStop.body': 'Anything running on {name} will stop.', // draft
  'compute.confirmOnTenant': '{action} {name} on tenant {tenant}?', // draft
  'compute.empty': 'No virtual machines yet', // draft
  'compute.loadMore': 'Load more', // draft
  'compute.chooseTenant': 'Choose a tenant to see its virtual machines.', // draft
  'compute.actingOnTenant': 'Acting on tenant {displayName}', // draft
  'compute.operationInProgress': 'Operation in progress', // draft
  'compute.vmInError': 'No actions are available while this VM is in error.', // draft
  'compute.vmNowStatus': '{name} is now {status}.', // draft
  'compute.moreStatusChanges': '{count} more VMs changed status.', // draft
  'compute.progress': '{percent}%', // draft
  'compute.toast.started': '{name} started.', // draft
  'compute.toast.stopped': '{name} stopped.', // draft
  'compute.toast.rebooted': '{name} rebooted.', // draft
  'compute.drawer.overview': 'Overview', // draft
  'compute.drawer.currentTask': 'Current task', // draft
  'compute.drawer.recentTasks': 'Recent tasks', // draft
  'compute.fields.status': 'Status', // draft
  'compute.fields.vcpus': 'vCPU', // draft
  'compute.fields.memory': 'Memory', // draft
  'compute.fields.disk': 'Disk', // draft
  'compute.fields.ip': 'IP address', // draft
  'compute.fields.image': 'Image', // draft
  'compute.fields.created': 'Created', // draft
  'compute.recentTasks.empty': 'No tasks for this VM in the last 24 hours.', // draft
} as const;

export const { t, tp } = createTranslator({ ...shared, ...computeEn });
