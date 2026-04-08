/**
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createLogger } from '@/lib/logger';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createLogger', () => {
  test('should return a child logger with the correct module binding', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const logger = createLogger('test-module');

    logger.info('hello');

    expect(consoleSpy).toHaveBeenCalledOnce();

    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);

    expect(output.module).toBe('test-module');

    consoleSpy.mockRestore();
  });

  test('should include level, time, module, and msg as top-level JSON fields', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const logger = createLogger('fields-test');

    logger.info('test message');

    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);

    expect(output).toHaveProperty('level');
    expect(output).toHaveProperty('time');
    expect(output).toHaveProperty('module', 'fields-test');
    expect(output).toHaveProperty('msg', 'test message');

    consoleSpy.mockRestore();
  });

  test('should serialize an Error binding to type, message, and stack fields', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const logger = createLogger('err-test');
    const error = new Error('something went wrong');

    logger.error({ err: error }, 'error occurred');

    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);

    expect(output.err).toBeDefined();
    expect(output.err.type).toBe('Error');
    expect(output.err.message ?? output.err.msg).toBe('something went wrong');
    expect(output.err.stack).toContain('Error: something went wrong');

    consoleSpy.mockRestore();
  });

  test('should not throw when a circular reference is passed as a context binding', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const logger = createLogger('circular-test');
    const circular: Record<string, unknown> = { name: 'circular' };

    circular.self = circular;

    expect(() =>
      logger.info({ context: circular }, 'circular ref'),
    ).not.toThrow();

    consoleSpy.mockRestore();
  });
});

describe('createLogger log-level routing', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('should route logger.info to console.log', () => {
    const logger = createLogger('routing-test');

    logger.info('info message');

    expect(logSpy).toHaveBeenCalledOnce();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test('should route logger.warn to console.warn', () => {
    const logger = createLogger('routing-test');

    logger.warn('warn message');

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test('should route logger.error to console.error', () => {
    const logger = createLogger('routing-test');

    logger.error('error message');

    expect(errorSpy).toHaveBeenCalledOnce();
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('createLogger context fields', () => {
  test('should include context fields as top-level JSON fields alongside module, level, time, and msg', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const logger = createLogger('context-test');

    logger.info({ invitationId: 'abc123' }, 'invite context');

    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);

    expect(output).toHaveProperty('module', 'context-test');
    expect(output).toHaveProperty('level');
    expect(output).toHaveProperty('time');
    expect(output).toHaveProperty('msg', 'invite context');
    expect(output).toHaveProperty('invitationId', 'abc123');

    consoleSpy.mockRestore();
  });
});
