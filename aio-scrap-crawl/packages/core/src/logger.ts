/**
 * Tiny dependency-free leveled logger.
 *
 * Always writes to stderr so stdout stays clean for piped data (e.g. exporters
 * streaming JSON to a pipe).
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 99,
};

export interface Logger {
  readonly level: LogLevel;
  debug(msg: string, meta?: unknown): void;
  info(msg: string, meta?: unknown): void;
  warn(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
  child(scope: string): Logger;
}

export interface LoggerOptions {
  level?: LogLevel;
  json?: boolean;
  scope?: string;
}

export function createLogger(opts: LoggerOptions = {}): Logger {
  const level: LogLevel = opts.level ?? 'info';
  const json = opts.json ?? false;
  const scope = opts.scope;
  const threshold = WEIGHT[level];

  function emit(lvl: Exclude<LogLevel, 'silent'>, msg: string, meta?: unknown): void {
    if (WEIGHT[lvl] < threshold) return;
    if (json) {
      const rec: Record<string, unknown> = {
        ts: new Date().toISOString(),
        level: lvl,
        msg,
      };
      if (scope) rec.scope = scope;
      if (meta !== undefined) rec.meta = meta;
      process.stderr.write(JSON.stringify(rec) + '\n');
    } else {
      const tag = scope ? `[${scope}] ` : '';
      const extra = meta !== undefined ? ' ' + safeInspect(meta) : '';
      process.stderr.write(`${lvl.toUpperCase().padEnd(5)} ${tag}${msg}${extra}\n`);
    }
  }

  return {
    level,
    debug: (m, x) => emit('debug', m, x),
    info: (m, x) => emit('info', m, x),
    warn: (m, x) => emit('warn', m, x),
    error: (m, x) => emit('error', m, x),
    child: (childScope) =>
      createLogger({
        level,
        json,
        scope: scope ? `${scope}:${childScope}` : childScope,
      }),
  };
}

function safeInspect(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
