import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLogEntries, configureLogger, createLogger, logEntries } from './index';

describe('logger', () => {
  beforeEach(() => {
    clearLogEntries();
    configureLogger({ production: false });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('TECH-14: writes to the console with the [nimbus][source] prefix', () => {
    createLogger('compute').error('remote.render_failed', { id: 1 });
    expect(console.error).toHaveBeenCalledWith('[nimbus][compute] remote.render_failed', { id: 1 });
  });

  it('TECH-14: buffers one entry per occurrence, with source, level and data', () => {
    const log = createLogger('shell');
    log.warn('realtime.invalid_message');
    log.warn('realtime.invalid_message');
    const entries = logEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ level: 'warn', source: 'shell', event: 'realtime.invalid_message' });
  });

  it('TECH-14: keeps only the last 200 entries', () => {
    const log = createLogger('shell');
    for (let i = 0; i < 205; i++) log.error(`e${i}`);
    const entries = log.entries();
    expect(entries).toHaveLength(200);
    expect(entries[0]?.event).toBe('e5');
    expect(entries[199]?.event).toBe('e204');
  });

  it('TECH-14: production drops info but keeps warn and error', () => {
    configureLogger({ production: true });
    const log = createLogger('shell');
    log.info('boot');
    log.warn('slow');
    log.error('broken');
    expect(logEntries().map((e) => e.level)).toEqual(['warn', 'error']);
    expect(console.info).not.toHaveBeenCalled();
  });
});
