/**
 * @vitest-environment node
 */

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

import { expect, test, describe, beforeEach, vi } from 'vitest';
import { authorizeCredentials } from './auth-credentials';
import { getDb } from '@/lib/db';
import type { DbClient } from '@/lib/db';

const mockGetDb = vi.mocked(getDb);

describe('createAuth - admin credentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  test('should return a user with roles: ["admin"] when credentials match ADMIN_USERNAME and ADMIN_PASSWORD env vars', async () => {
    vi.stubEnv('ADMIN_USERNAME', 'AdminFirst');
    vi.stubEnv('ADMIN_PASSWORD', 'AdminPass');

    const result = await authorizeCredentials({
      firstName: 'AdminFirst',
      lastName: 'AdminPass',
    });

    expect(result).toEqual({
      id: 'admin',
      name: 'Admin',
      email: null,
      roles: ['admin'],
    });
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  test('should not return an admin user when ADMIN_USERNAME env var is not set', async () => {
    vi.stubEnv('ADMIN_PASSWORD', 'AdminPass');
    delete process.env.ADMIN_USERNAME;

    mockGetDb.mockReturnValue(createMockDbWithGuest(undefined));

    const result = await authorizeCredentials({
      firstName: 'AdminFirst',
      lastName: 'AdminPass',
    });

    expect(result).toBeNull();
    expect(mockGetDb).toHaveBeenCalled();
  });

  test('should fall through to guest name lookup when credentials do not match admin env vars', async () => {
    vi.stubEnv('ADMIN_USERNAME', 'AdminFirst');
    vi.stubEnv('ADMIN_PASSWORD', 'AdminPass');

    mockGetDb.mockReturnValue(createMockDbWithGuest(undefined));

    const result = await authorizeCredentials({
      firstName: 'NotAdmin',
      lastName: 'NotPassword',
    });

    expect(result).toBeNull();
    expect(mockGetDb).toHaveBeenCalled();
  });

  test('should not attach guestId to the returned user when credentials match admin env vars', async () => {
    vi.stubEnv('ADMIN_USERNAME', 'AdminFirst');
    vi.stubEnv('ADMIN_PASSWORD', 'AdminPass');

    const result = await authorizeCredentials({
      firstName: 'AdminFirst',
      lastName: 'AdminPass',
    });

    expect(result).not.toBeNull();
    expect((result as Record<string, unknown>).guestId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a minimal mock Drizzle database for auth tests.
 *
 * @param guest - The guest record to return from findFirst, or undefined.
 * @returns Partial DbClient mock.
 */
function createMockDbWithGuest(
  guest: Record<string, unknown> | undefined,
): DbClient {
  return {
    query: {
      guests: {
        findFirst: vi.fn().mockResolvedValue(guest),
      },
      users: {
        findFirst: vi.fn().mockResolvedValue(undefined),
      },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  } as unknown as DbClient;
}
