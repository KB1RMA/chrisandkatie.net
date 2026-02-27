/**
 * @vitest-environment node
 */

import { expect, test, describe, beforeEach, vi } from 'vitest';
import { authorizeInvitationCode } from '@/lib/auth-invitation-code';
import type { DbClient } from '@/lib/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock Drizzle database for testing invitation code authorization.
 *
 * @param overrides - Per-query mock overrides.
 * @returns Partial DbClient mock.
 */
function createMockDb(
  overrides: Partial<{
    invitationFindFirst: ReturnType<typeof vi.fn>;
    userFindFirst: ReturnType<typeof vi.fn>;
    insertValues: ReturnType<typeof vi.fn>;
    updateSetWhere: ReturnType<typeof vi.fn>;
  }> = {},
): DbClient {
  const insertValuesFn =
    overrides.insertValues ?? vi.fn().mockResolvedValue(undefined);
  const insertFn = vi.fn().mockReturnValue({ values: insertValuesFn });

  const updateSetWhereFn =
    overrides.updateSetWhere ?? vi.fn().mockResolvedValue(undefined);
  const updateSetFn = vi.fn().mockReturnValue({ where: updateSetWhereFn });
  const updateFn = vi.fn().mockReturnValue({ set: updateSetFn });

  return {
    query: {
      invitations: {
        findFirst:
          overrides.invitationFindFirst ?? vi.fn().mockResolvedValue(null),
      },
      users: {
        findFirst: overrides.userFindFirst ?? vi.fn().mockResolvedValue(null),
      },
    },
    insert: insertFn,
    update: updateFn,
  } as unknown as DbClient;
}

/** Minimal invitation fixture with a known code and no linked User yet. */
const makeInvitation = (
  overrides: Partial<{
    id: string;
    invitationCode: string;
    userId: string | null;
  }> = {},
) => ({
  id: overrides.id ?? 'invitation-1',
  invitationCode: overrides.invitationCode ?? 'swift-panda',
  userId: overrides.userId ?? null,
  relationshipToCouple: null,
  totalInvited: 2,
  address: null,
  addressLine2: null,
  city: null,
  state: null,
  zipCode: null,
  country: null,
  mailingAddress: null,
  visibleEvents: '[0,1,2,3]',
  contactEmail: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

/** Minimal user fixture. */
const makeUser = (
  overrides: Partial<{ id: string; name: string; email: string | null }> = {},
) => ({
  id: overrides.id ?? 'user-1',
  name: overrides.name ?? 'Invitation',
  email: overrides.email ?? null,
  emailVerified: null,
  image: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('authorizeInvitationCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should return null when invitationCode is missing', async () => {
    const db = createMockDb();
    const result = await authorizeInvitationCode({}, db);

    expect(result).toBeNull();
  });

  test('should return null when invitationCode is empty string', async () => {
    const db = createMockDb();
    const result = await authorizeInvitationCode({ invitationCode: '' }, db);

    expect(result).toBeNull();
  });

  test('should return null when invitation code is not found in the database', async () => {
    const db = createMockDb({
      invitationFindFirst: vi.fn().mockResolvedValue(null),
    });

    const result = await authorizeInvitationCode(
      { invitationCode: 'unknown-code' },
      db,
    );

    expect(result).toBeNull();
  });

  test('should perform case-insensitive code lookup', async () => {
    const invitationFindFirst = vi
      .fn()
      .mockResolvedValue(makeInvitation({ invitationCode: 'swift-panda' }));
    const db = createMockDb({ invitationFindFirst });

    await authorizeInvitationCode({ invitationCode: 'SWIFT-PANDA' }, db);

    expect(invitationFindFirst).toHaveBeenCalled();
  });

  test('should return user object with invitationId when code matches', async () => {
    const db = createMockDb({
      invitationFindFirst: vi.fn().mockResolvedValue(makeInvitation()),
    });

    const result = await authorizeInvitationCode(
      { invitationCode: 'swift-panda' },
      db,
    );

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      invitationId: 'invitation-1',
      roles: ['guest'],
    });
  });

  test('should create a new User record when invitation has no linked userId', async () => {
    const insertValues = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb({
      invitationFindFirst: vi
        .fn()
        .mockResolvedValue(makeInvitation({ userId: null })),
      insertValues,
    });

    const result = await authorizeInvitationCode(
      { invitationCode: 'swift-panda' },
      db,
    );

    expect(insertValues).toHaveBeenCalled();
    expect(result).not.toBeNull();
    expect(result?.invitationId).toBe('invitation-1');
  });

  test('should reuse existing User record when invitation already has a userId', async () => {
    const userFindFirst = vi
      .fn()
      .mockResolvedValue(makeUser({ id: 'user-existing' }));
    const insertValues = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb({
      invitationFindFirst: vi
        .fn()
        .mockResolvedValue(makeInvitation({ userId: 'user-existing' })),
      userFindFirst,
      insertValues,
    });

    const result = await authorizeInvitationCode(
      { invitationCode: 'swift-panda' },
      db,
    );

    expect(insertValues).not.toHaveBeenCalled();
    expect(result?.id).toBe('user-existing');
  });

  test('should return id, name, invitationId, and roles shape', async () => {
    const db = createMockDb({
      invitationFindFirst: vi.fn().mockResolvedValue(makeInvitation()),
    });

    const result = await authorizeInvitationCode(
      { invitationCode: 'swift-panda' },
      db,
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        invitationId: 'invitation-1',
        roles: ['guest'],
      }),
    );
  });
});
