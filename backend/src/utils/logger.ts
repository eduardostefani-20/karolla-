/* Logger estruturado mínimo (JSON por linha). Pode ser trocado por pino/winston sem alterar chamadas. */
type Level = 'debug' | 'info' | 'warn' | 'error';

const silent = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

function write(level: Level, message: string, meta?: Record<string, unknown>) {
  if (silent && level !== 'error') return;
  if (silent && process.env.LOG_ERRORS_IN_TEST !== 'true') return;
  const line = JSON.stringify({ level, time: new Date().toISOString(), message, ...meta });
  (level === 'error' || level === 'warn' ? console.error : console.log)(line);
}

export const logger = {
  debug: (m: string, meta?: Record<string, unknown>) => write('debug', m, meta),
  info: (m: string, meta?: Record<string, unknown>) => write('info', m, meta),
  warn: (m: string, meta?: Record<string, unknown>) => write('warn', m, meta),
  error: (m: string, meta?: Record<string, unknown>) => write('error', m, meta),
};

export function errorMeta(err: unknown): Record<string, unknown> {
  if (err instanceof Error) return { error: err.message, name: err.name, stack: err.stack };
  return { error: String(err) };
}
