import { describe, expect, it } from 'vitest';
import {
  bytesToGib,
  formatBytes,
  formatCount,
  formatDateTime,
  formatMoney,
  formatPercent,
  formatRelativeTime,
  gibToBytes,
  usageLevel,
} from './index';

// Examples from specs/shared/messages-and-format.md. Tests run with TZ=UTC (vitest.config.ts).
describe('libs/format', () => {
  it('TECH-14: formatBytes uses binary units and drops a trailing .0', () => {
    expect(formatBytes(107374182400)).toBe('100 GiB');
    expect(formatBytes(1610612736)).toBe('1.5 GiB');
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1 KiB');
    expect(formatBytes(1099511627776)).toBe('1 TiB');
    expect(formatBytes(1024 ** 3 * 1023.97)).toBe('1 TiB'); // rounding to 1024 moves up a unit
  });

  it('TECH-14: gibToBytes and bytesToGib convert whole GiB', () => {
    expect(gibToBytes(100)).toBe(107374182400);
    expect(bytesToGib(107374182400)).toBe(100);
  });

  it('TECH-14: formatPercent floors, including floating-point edge cases', () => {
    expect(formatPercent(0.799)).toBe('79%');
    expect(formatPercent(1.04)).toBe('104%');
    expect(formatPercent(0.29)).toBe('29%');
    expect(formatPercent(0.85)).toBe('85%');
  });

  it('TECH-14: usageLevel uses the exact ratio for thresholds', () => {
    expect(usageLevel(0.799)).toBe('ok');
    expect(usageLevel(0.8)).toBe('warning');
    expect(usageLevel(0.949)).toBe('warning');
    expect(usageLevel(0.95)).toBe('danger');
    expect(usageLevel(1.04)).toBe('danger');
  });

  it('TECH-14: formatCount groups thousands', () => {
    expect(formatCount(10000)).toBe('10,000');
  });

  it('TECH-14: formatDateTime uses en-GB medium date and short time', () => {
    expect(formatDateTime('2026-10-30T22:01:00Z')).toBe('30 Oct 2026, 22:01');
  });

  it('TECH-14: formatRelativeTime for the last 24 h, formatDateTime beyond', () => {
    const now = new Date('2026-10-31T12:00:00Z');
    expect(formatRelativeTime('2026-10-31T11:58:00Z', now)).toBe('2 minutes ago');
    expect(formatRelativeTime('2026-10-31T09:00:00Z', now)).toBe('3 hours ago');
    expect(formatRelativeTime('2026-10-31T11:59:30Z', now)).toBe('30 seconds ago');
    expect(formatRelativeTime('2026-10-29T12:00:00Z', now)).toBe('29 Oct 2026, 12:00');
  });

  it('TECH-14: formatMoney shows micro-unit prices with 2 to 4 decimals', () => {
    expect(formatMoney({ amountMicros: 35000, currency: 'EUR' })).toBe('€0.035');
    expect(formatMoney({ amountMicros: 6000000, currency: 'EUR' })).toBe('€6.00');
    expect(formatMoney({ amountMicros: 25000, currency: 'EUR' })).toBe('€0.025');
  });
});
