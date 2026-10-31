// Framework-agnostic logger (SPEC.md §9 Logging).
// Console output with the prefix `[nimbus][<source>] <event>`, plus an in-memory ring buffer of the last
// 200 entries for tests and the dev-only /_debug page. "Logged once" means one entry per occurrence.

export type LogLevel = 'error' | 'warn' | 'info';

export interface LogEntry {
  level: LogLevel;
  source: string;
  event: string;
  data?: object;
  ts: number;
}

export interface Logger {
  error(event: string, data?: object): void;
  warn(event: string, data?: object): void;
  info(event: string, data?: object): void;
  /** All buffered entries (every source), oldest first. */
  entries(): readonly LogEntry[];
}

const CAPACITY = 200;
const buffer: LogEntry[] = [];
let dropInfo = false;

/** Production builds keep `error` and `warn` and drop `info`. Call once at start-up. */
export function configureLogger(options: { production: boolean }): void {
  dropInfo = options.production;
}

/** For tests. */
export function clearLogEntries(): void {
  buffer.length = 0;
}

export function logEntries(): readonly LogEntry[] {
  return buffer.slice();
}

export function createLogger(source: string): Logger {
  const write = (level: LogLevel, event: string, data?: object) => {
    if (level === 'info' && dropInfo) return;
    const entry: LogEntry = { level, source, event, ts: Date.now(), ...(data ? { data } : {}) };
    buffer.push(entry);
    if (buffer.length > CAPACITY) buffer.splice(0, buffer.length - CAPACITY);
    const line = `[nimbus][${source}] ${event}`;
    if (data) console[level](line, data);
    else console[level](line);
  };
  return {
    error: (event, data) => write('error', event, data),
    warn: (event, data) => write('warn', event, data),
    info: (event, data) => write('info', event, data),
    entries: logEntries,
  };
}
