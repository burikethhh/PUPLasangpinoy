/**
 * Centralized structured logger for LasangPinoy Mobile.
 *
 * Usage:
 *   import { createLogger } from './logger';
 *   const log = createLogger('Firebase');
 *   log.info('Initialized');
 *   log.error('Failed to fetch', error);
 *
 * Retrieve recent logs (e.g. for a debug screen):
 *   import { getLogs, getErrorLogs } from './logger';
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
  timestamp: string;
}

export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

// ── Internal circular buffer ─────────────────────────────
const MAX_BUFFER = 200;
const _buffer: LogEntry[] = [];

function serializeData(data: unknown): unknown {
  if (data instanceof Error) {
    return { name: data.name, message: data.message, stack: data.stack };
  }
  return data;
}

function _log(
  level: LogLevel,
  module: string,
  message: string,
  data?: unknown,
): void {
  const entry: LogEntry = {
    level,
    module,
    message,
    data: data !== undefined ? serializeData(data) : undefined,
    timestamp: new Date().toISOString(),
  };

  // Circular buffer — drop oldest when full
  if (_buffer.length >= MAX_BUFFER) _buffer.shift();
  _buffer.push(entry);

  const time = entry.timestamp.slice(11, 23); // HH:mm:ss.ms
  const tag = `[${time}] [${module}]`;

  switch (level) {
    case "debug":
      console.debug(`${tag} ${message}`, ...(data !== undefined ? [data] : []));
      break;
    case "info":
      console.info(`${tag} ℹ ${message}`, ...(data !== undefined ? [data] : []));
      break;
    case "warn":
      console.warn(`${tag} ⚠ ${message}`, ...(data !== undefined ? [data] : []));
      break;
    case "error":
      console.error(
        `${tag} ✖ ${message}`,
        ...(data !== undefined ? [data] : []),
      );
      break;
  }
}

// ── Public API ───────────────────────────────────────────

/**
 * Create a module-scoped logger instance.
 * The `module` string appears in every log entry for filtering.
 */
export function createLogger(module: string): Logger {
  return {
    debug: (msg, data) => _log("debug", module, msg, data),
    info: (msg, data) => _log("info", module, msg, data),
    warn: (msg, data) => _log("warn", module, msg, data),
    error: (msg, data) => _log("error", module, msg, data),
  };
}

/** Return a copy of all entries, optionally filtered by level. */
export function getLogs(level?: LogLevel): LogEntry[] {
  if (level) return _buffer.filter((e) => e.level === level);
  return [..._buffer];
}

/** Return only WARN and ERROR entries (useful for a debug overlay). */
export function getErrorLogs(): LogEntry[] {
  return _buffer.filter((e) => e.level === "warn" || e.level === "error");
}

/** Clear the in-memory log buffer. */
export function clearLogs(): void {
  _buffer.length = 0;
}

/** Count entries by level — handy for a badge on a debug screen. */
export function getLogCount(level?: LogLevel): number {
  return level ? _buffer.filter((e) => e.level === level).length : _buffer.length;
}
