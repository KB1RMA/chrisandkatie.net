/**
 * @vitest-environment node
 */

import { expect, test, describe, vi, afterEach } from 'vitest';
import {
  generateInvitationCode,
  generateInvitationCodeBatch,
  generateUniqueInvitationCode,
  MIN_WORD_LENGTH,
  MAX_WORD_LENGTH,
} from '@/lib/invitation-code';
import type { DbClient } from '@/lib/db';

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

/**
 * Stubs globalThis.fetch to return the given word array.
 *
 * @param words - Words the API should return.
 */
function mockFetchWords(words: string[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(words),
    }),
  );
}

/**
 * Stubs globalThis.fetch to return a non-ok HTTP response.
 *
 * @param status - HTTP status code to simulate.
 */
function mockFetchError(status = 500) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      statusText: 'Internal Server Error',
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// DB mock helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock database that returns the provided invitation code lookup result.
 *
 * @param existingCode - The invitation to return from findFirst (null = unique, no collision).
 * @returns Partial DbClient mock.
 */
function createMockDb(
  existingCode: Record<string, unknown> | null = null,
): DbClient {
  return {
    query: {
      invitations: {
        findFirst: vi.fn().mockResolvedValue(existingCode),
      },
    },
  } as unknown as DbClient;
}

/**
 * Creates a mock database that returns collisions for first n attempts then null.
 *
 * @param collisions - Number of times to return a collision before returning null.
 * @returns Partial DbClient mock.
 */
function createCollisionDb(collisions: number): DbClient {
  let callCount = 0;

  return {
    query: {
      invitations: {
        findFirst: vi.fn().mockImplementation(() => {
          callCount += 1;

          if (callCount <= collisions) {
            return Promise.resolve({ id: 'existing-invitation' });
          }

          return Promise.resolve(null);
        }),
      },
    },
  } as unknown as DbClient;
}

// ---------------------------------------------------------------------------
// generateInvitationCode
// ---------------------------------------------------------------------------

describe('generateInvitationCode', () => {
  test('should return a string', async () => {
    mockFetchWords(['swift', 'panda']);

    const code = await generateInvitationCode();

    expect(typeof code).toBe('string');
  });

  test('should return the two API words joined by a hyphen', async () => {
    mockFetchWords(['swift', 'panda']);

    const code = await generateInvitationCode();

    expect(code).toBe('swift-panda');
  });

  test('should match the two-word hyphen-joined format', async () => {
    mockFetchWords(['swift', 'panda']);

    const code = await generateInvitationCode();

    expect(code).toMatch(/^[a-z]+-[a-z]+$/);
  });

  test('should normalise API words to lowercase', async () => {
    mockFetchWords(['SWIFT', 'PANDA']);

    const code = await generateInvitationCode();

    expect(code).toBe('swift-panda');
  });

  test('should contain exactly one hyphen', async () => {
    mockFetchWords(['swift', 'panda']);

    const code = await generateInvitationCode();

    expect(code.split('-')).toHaveLength(2);
  });

  test('should have non-empty words on both sides of the hyphen', async () => {
    mockFetchWords(['swift', 'panda']);

    const code = await generateInvitationCode();
    const [firstWord, secondWord] = code.split('-');

    expect(firstWord.length).toBeGreaterThan(0);
    expect(secondWord.length).toBeGreaterThan(0);
  });

  test('should throw when the word API returns a non-ok response', async () => {
    mockFetchError(503);

    await expect(generateInvitationCode()).rejects.toThrow(/503/);
  });

  test('should throw when the API returns an unexpected shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ error: 'not an array' }),
      }),
    );

    await expect(generateInvitationCode()).rejects.toThrow(/unexpected/i);
  });

  test('should throw when the API does not return enough words after filtering', async () => {
    // All single-char words are below MIN_WORD_LENGTH and will be filtered out
    mockFetchWords(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);

    await expect(generateInvitationCode()).rejects.toThrow(
      /too few usable words/i,
    );
  });

  test('should filter out words longer than MAX_WORD_LENGTH', async () => {
    // First two words are too long; last two are valid
    mockFetchWords(['methylases', 'epicardia', 'swift', 'panda']);

    const code = await generateInvitationCode();

    expect(code).toBe('swift-panda');
  });

  test('should enforce MIN_WORD_LENGTH and MAX_WORD_LENGTH constants', () => {
    expect(MIN_WORD_LENGTH).toBeLessThanOrEqual(MAX_WORD_LENGTH);
    expect(MIN_WORD_LENGTH).toBeGreaterThanOrEqual(2);
    expect(MAX_WORD_LENGTH).toBeLessThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// generateInvitationCodeBatch
// ---------------------------------------------------------------------------

describe('generateInvitationCodeBatch', () => {
  test('should return the requested number of codes', async () => {
    mockFetchWords(['swift', 'panda', 'bold', 'eagle', 'calm', 'river']);

    const codes = await generateInvitationCodeBatch(3);

    expect(codes).toHaveLength(3);
  });

  test('should pair API words in order as first-second', async () => {
    mockFetchWords(['swift', 'panda', 'bold', 'eagle']);

    const codes = await generateInvitationCodeBatch(2);

    expect(codes).toEqual(['swift-panda', 'bold-eagle']);
  });

  test('should use a single fetch call for the whole batch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      // Return enough valid-length words (≥MIN_WORD_LENGTH) to satisfy the filter
      json: () =>
        Promise.resolve([
          'cat',
          'dog',
          'fox',
          'owl',
          'ant',
          'elk',
          'hen',
          'jay',
          'ram',
          'bee',
          'cod',
          'eel',
          'gnu',
          'koi',
          'rat',
          'yak',
        ]),
    });

    vi.stubGlobal('fetch', fetchMock);

    await generateInvitationCodeBatch(2);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// generateUniqueInvitationCode
// ---------------------------------------------------------------------------

describe('generateUniqueInvitationCode', () => {
  test('should return a valid format code when no collision exists', async () => {
    mockFetchWords(['swift', 'panda']);

    const db = createMockDb(null);
    const code = await generateUniqueInvitationCode(db);

    expect(code).toMatch(/^[a-z]+-[a-z]+$/);
  });

  test('should retry and return a code after a single collision', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(['swift', 'panda']),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(['bold', 'eagle']),
        }),
    );

    const db = createCollisionDb(1);
    const code = await generateUniqueInvitationCode(db);

    expect(code).toMatch(/^[a-z]+-[a-z]+$/);
  });

  test('should retry up to 9 collisions and still succeed on the 10th attempt', async () => {
    const fetchMock = vi.fn();

    const wordPairs = [
      ['brave', 'hawk'],
      ['calm', 'deer'],
      ['bold', 'wolf'],
      ['keen', 'bear'],
      ['mild', 'fawn'],
      ['soft', 'wren'],
      ['wise', 'lark'],
      ['glad', 'swan'],
      ['warm', 'dove'],
    ];

    for (const [first, second] of wordPairs) {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([first, second]),
      });
    }

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(['final', 'code']),
    });

    vi.stubGlobal('fetch', fetchMock);

    const db = createCollisionDb(9);
    const code = await generateUniqueInvitationCode(db);

    expect(code).toMatch(/^[a-z]+-[a-z]+$/);
  });

  test('should throw an error when all MAX_ATTEMPTS are exhausted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(['swift', 'panda']),
      }),
    );

    const db = createCollisionDb(10);

    await expect(generateUniqueInvitationCode(db)).rejects.toThrow(
      /max attempts|exhausted|collision/i,
    );
  });
});
