import pino from 'pino/browser';

// Pino browser always passes an object to custom write handlers.
// A fresh WeakSet per call handles circular references without losing fields.
function safeStringify(obj: unknown): string {
  const seen = new WeakSet<object>();

  return JSON.stringify(obj, (_key, value: unknown) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }

      seen.add(value);
    }

    return value;
  });
}

const baseLogger = pino({
  browser: {
    // serialize: true applies field-level serializers (e.g. err) before write receives the object.
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
