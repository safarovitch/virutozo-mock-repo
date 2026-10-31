import { describe, expect, it } from 'vitest';
import { createTranslator, en, interpolate, t } from './index';

describe('libs/messages', () => {
  it('TECH-14: t() returns the catalogue text', () => {
    expect(t('errors.TENANT_NAME_TAKEN')).toBe('This name is already taken.');
  });

  it('TECH-14: fills placeholders as plain text, never HTML', () => {
    expect(t('errors.VM_BUSY', { name: '<b>web-01</b>' })).toBe('<b>web-01</b> is busy with another operation.');
    expect(interpolate('{a} and {missing}', { a: 1 })).toBe('1 and {missing}');
  });

  it('MSG-2: tp() picks _one / _other with Intl.PluralRules and passes count', () => {
    const { tp } = createTranslator({ 'shell.runningTasks_one': '{count} running task', 'shell.runningTasks_other': '{count} running tasks' });
    expect(tp('shell.runningTasks', 1)).toBe('1 running task');
    expect(tp('shell.runningTasks', 2)).toBe('2 running tasks');
    expect(tp('shell.runningTasks', 0)).toBe('0 running tasks');
  });

  it('TECH-14: catalogue texts match specs/mock-data.md for the accepted strings', () => {
    expect(en['rbac.disabledTooltip']).toBe("You don't have permission to {action}.");
    expect(interpolate(en['rbac.disabledTooltip'], { action: en['actions.suspendTenant'] })).toBe(
      "You don't have permission to suspend tenants.",
    );
    expect(en['errors.QUOTA_BELOW_USAGE.vms']).toBe("VM quota can't be lower than the current number of VMs ({used}).");
  });
});
