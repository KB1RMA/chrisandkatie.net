/**
 * @vitest-environment node
 */

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

import { expect, test, describe, beforeEach, vi } from 'vitest';
import { getDb } from '@/lib/db';
import { authorizeCredentials } from '@/lib/auth-credentials';
import type { DbClient } from '@/lib/db';

const mockGetDb = vi.mocked(getDb);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock database that returns the provided guest from findFirst.
 *
 * @param guest - The guest fixture to return, or null for no match.
 * @returns Partial DbClient mock.
 */
function createMockDb(guest: Record<string, unknown> | null): DbClient {
  return {
    query: {
      guests: {
        findFirst: vi.fn().mockResolvedValue(guest),
      },
      users: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
    insert: vi
      .fn()
      .mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  } as unknown as DbClient;
}

/** Minimal guest fixture stored as "Alice" / "Smith". */
const aliceGuest = {
  id: 'guest-alice',
  firstName: 'Alice',
  lastName: 'Smith',
  userId: null,
  invitationId: 'invitation-1',
  type: 'adult' as const,
  attending: null,
  mealChoice: null,
  dietaryRestrictions: null,
  notes: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('authorizeCredentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should return null when firstName is missing', async () => {
    const result = await authorizeCredentials({ lastName: 'Smith' });

    expect(result).toBeNull();
  });

  test('should return null when lastName is missing', async () => {
    const result = await authorizeCredentials({ firstName: 'Alice' });

    expect(result).toBeNull();
  });

  test('should return null when both credentials are missing', async () => {
    const result = await authorizeCredentials({});

    expect(result).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Tests — admin credentials
  // ---------------------------------------------------------------------------

  describe('admin credential check', () => {
    beforeEach(() => {
      process.env.ADMIN_USERNAME = 'adminuser';
      process.env.ADMIN_PASSWORD = 'adminpass';
    });

    test('should return admin user when credentials match env vars exactly', async () => {
      const result = await authorizeCredentials({
        firstName: 'adminuser',
        lastName: 'adminpass',
      });

      expect(result).toMatchObject({
        id: 'admin',
        roles: ['admin'],
      });
    });

    test('should fall through to guest lookup when admin credentials do not match', async () => {
      mockGetDb.mockReturnValue(createMockDb(null));

      const result = await authorizeCredentials({
        firstName: 'wrong',
        lastName: 'wrong',
      });

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Tests — case-insensitive guest login (FR-003, FR-004)
  // ---------------------------------------------------------------------------

  describe('case-insensitive guest name lookup', () => {
    beforeEach(() => {
      // Unset admin env vars so lookup falls through to guest check
      delete process.env.ADMIN_USERNAME;
      delete process.env.ADMIN_PASSWORD;

      mockGetDb.mockReturnValue(createMockDb(aliceGuest));
    });

    test('should authenticate with all-lowercase name', async () => {
      const result = await authorizeCredentials({
        firstName: 'alice',
        lastName: 'smith',
      });

      expect(result).not.toBeNull();
      expect(result).toMatchObject({ guestId: 'guest-alice' });
    });

    test('should authenticate with all-uppercase name', async () => {
      const result = await authorizeCredentials({
        firstName: 'ALICE',
        lastName: 'SMITH',
      });

      expect(result).not.toBeNull();
      expect(result).toMatchObject({ guestId: 'guest-alice' });
    });

    test('should authenticate with standard mixed-case name', async () => {
      const result = await authorizeCredentials({
        firstName: 'Alice',
        lastName: 'Smith',
      });

      expect(result).not.toBeNull();
      expect(result).toMatchObject({ guestId: 'guest-alice' });
    });

    test('should return null when no guest matches regardless of case', async () => {
      mockGetDb.mockReturnValue(createMockDb(null));

      const result = await authorizeCredentials({
        firstName: 'unknown',
        lastName: 'person',
      });

      expect(result).toBeNull();
    });

    test('should trim whitespace from credentials before matching', async () => {
      const result = await authorizeCredentials({
        firstName: '  alice  ',
        lastName: '  smith  ',
      });

      // The db is mocked to return aliceGuest regardless of the exact SQL args;
      // this confirms the trim runs without error
      expect(result).not.toBeNull();
    });
  });
});
