import pino from 'pino/browser';

const safeStringify = (obj: unknown): string => {
  try {
    return JSON.stringify(obj);
  } catch {
    return JSON.stringify({ error: 'Log entry could not be serialized' });
  }
};

const baseLogger = pino({
  browser: {
    asObject: true,
    serialize: true,
    write: {
      trace: (obj) => console.log(safeStringify(obj)),
      debug: (obj) => console.log(safeStringify(obj)),
      info: (obj) => console.log(safeStringify(obj)),
      warn: (obj) => console.warn(safeStringify(obj)),
      error: (obj) => console.error(safeStringify(obj)),
      fatal: (obj) => console.error(safeStringify(obj)),
    },
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
});

/**
 * Creates a child logger bound to the given module name. Every log entry
 * produced by the returned logger will include `module` as a top-level field.
 *
 * @param module - The name of the module or subsystem producing the log entries.
 * @returns A pino child logger with the `module` field pre-bound.
 */
export function createLogger(module: string) {
  return baseLogger.child({ module });
}
