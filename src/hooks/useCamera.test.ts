/**
 * @vitest-environment jsdom
 */

import { describe, expect, test, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Import after environment setup
import { useCamera } from './useCamera';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a fake DOMException with the given name to simulate getUserMedia errors.
 *
 * @param name - The DOMException name (e.g. 'NotAllowedError').
 * @returns A DOMException instance.
 */
function makeDOMException(name: string): DOMException {
  const err = new DOMException('Simulated error', name);

  return err;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useCamera', () => {
  beforeEach(() => {
    // Reset any stubs between tests
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('error categorisation', () => {
    test('should return permission-denied when getUserMedia throws NotAllowedError', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: vi.fn().mockRejectedValue(makeDOMException('NotAllowedError')),
        },
      });

      const { result } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.startCamera();
      });

      expect(result.current.error).toBe('permission-denied');
      expect(result.current.stream).toBeNull();
    });

    test('should return no-camera when getUserMedia throws NotFoundError', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: vi.fn().mockRejectedValue(makeDOMException('NotFoundError')),
        },
      });

      const { result } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.startCamera();
      });

      expect(result.current.error).toBe('no-camera');
    });

    test('should return not-supported when getUserMedia throws NotSupportedError', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: vi.fn().mockRejectedValue(makeDOMException('NotSupportedError')),
        },
      });

      const { result } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.startCamera();
      });

      expect(result.current.error).toBe('not-supported');
    });

    test('should return overconstrained when getUserMedia throws OverconstrainedError', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: vi
            .fn()
            .mockRejectedValueOnce(makeDOMException('OverconstrainedError'))
            .mockRejectedValue(makeDOMException('OverconstrainedError')),
        },
      });

      const { result } = renderHook(() => useCamera());

      await act(async () => {
        await result.current.startCamera();
      });

      expect(result.current.error).toBe('overconstrained');
    });
  });

  describe('fallback detection', () => {
    test('should set isFallbackMode to true when navigator.mediaDevices is undefined', () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: undefined,
      });

      const { result } = renderHook(() => useCamera());

      expect(result.current.isFallbackMode).toBe(true);
    });

    test('should set isFallbackMode to false when navigator.mediaDevices.getUserMedia is available', () => {
      const mockStream = { getTracks: () => [] } as unknown as MediaStream;

      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: vi.fn().mockResolvedValue(mockStream),
        },
      });

      const { result } = renderHook(() => useCamera());

      expect(result.current.isFallbackMode).toBe(false);
    });
  });
});
