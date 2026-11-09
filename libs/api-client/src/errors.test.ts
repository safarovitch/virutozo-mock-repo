import { describe, expect, it } from 'vitest';
import { messageFor } from './errors';
import { ErrorCode } from './generated/model';

describe('messageFor (MSG-3)', () => {
  it('AC-SHL-9.1: every ErrorCode has its own message', () => {
    const internal = messageFor({ code: 'INTERNAL' });
    for (const code of Object.values(ErrorCode)) {
      const text = messageFor({ code, params: { resource: 'storage', plan: 'Starter', max: 1, used: 1, name: 'x', action: 'y', status: 'z' } });
      expect(text, code).toBeTruthy();
      if (code !== 'INTERNAL') expect(text, code).not.toBe(internal);
    }
  });

  it('AC-SHL-9.2: an unknown code shows the INTERNAL message', () => {
    expect(messageFor({ code: 'SOMETHING_NEW' as ErrorCode })).toBe('Something went wrong on our side. Try again.');
  });

  it('AC-SHL-9.3: QUOTA_EXCEEDS_PLAN for storage formats max with formatBytes', () => {
    expect(messageFor({ code: 'QUOTA_EXCEEDS_PLAN', params: { resource: 'storage', plan: 'Starter', max: 107374182400 } })).toBe(
      'Starter allows up to 100 GiB.',
    );
  });

  it('TECH-2: QUOTA_EXCEEDS_PLAN for VMs formats max with formatCount', () => {
    expect(messageFor({ code: 'QUOTA_EXCEEDS_PLAN', params: { resource: 'vms', plan: 'Starter', max: 10 } })).toBe(
      'Starter allows up to 10 VMs.',
    );
  });

  it('TECH-2: QUOTA_BELOW_USAGE picks the storage or VM wording', () => {
    expect(messageFor({ code: 'QUOTA_BELOW_USAGE', params: { resource: 'storage', used: 901943132160 } })).toBe(
      "Storage quota can't be lower than current usage (840 GiB).",
    );
    expect(messageFor({ code: 'QUOTA_BELOW_USAGE', params: { resource: 'vms', used: 40 } })).toBe(
      "VM quota can't be lower than the current number of VMs (40).",
    );
  });

  it('TECH-2: fills VM_BUSY and VM_INVALID_STATE from params', () => {
    expect(messageFor({ code: 'VM_BUSY', params: { name: 'web-01' } })).toBe('web-01 is busy with another operation.');
    expect(messageFor({ code: 'VM_INVALID_STATE', params: { name: 'web-01', action: 'start', status: 'running' } })).toBe(
      "web-01 can't start while it's running.",
    );
  });
});
