/**
 * @vitest-environment node
 */

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { expect, test, describe, beforeEach, vi } from 'vitest';
import { type Session } from 'next-auth';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import type { DbClient } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { updateInvitationVisibleEvents } from './actions';
import { guestEvents } from '@/lib/db/schema';

const mockAuth = vi.mocked(auth);
const mockGetDb = vi.mocked(getDb);
const mockRevalidatePath = vi.mocked(revalidatePath);

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

/**
 * Creates a mock Drizzle database for testing invitation visibility actions.
 *
 * @param overrides - Methods to override on the mock database.
 * @returns Partial DbClient with mocked methods.
 */
function createMockDb(
  overrides: Partial<{
    invitationFindFirst: ReturnType<typeof vi.fn>;
    deleteWhere: ReturnType<typeof vi.fn>;
    insertValues: ReturnType<typeof vi.fn>;
  }> = {},
): DbClient {
  const deleteWhereFn =
    overrides.deleteWhere ?? vi.fn().mockResolvedValue(undefined);
  const deleteFn = vi.fn().mockReturnValue({ where: deleteWhereFn });

  const insertValuesFn =
    overrides.insertValues ?? vi.fn().mockResolvedValue(undefined);
  const insertFn = vi.fn().mockReturnValue({ values: insertValuesFn });

  return {
    query: {
      invitations: {
        findFirst:
          overrides.invitationFindFirst ?? vi.fn().mockResolvedValue(null),
      },
    },
    insert: insertFn,
    delete: deleteFn,
  } as unknown as DbClient;
}

/** Creates a test session with guestId. */
function makeSession(guestId = 'guest-1'): Session {
  return {
    user: { id: 'user-1', guestId },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

/** Creates a test admin session with roles: ['admin'] and no guestId. */
function makeAdminSession(): Session {
  return {
    user: { id: 'admin', roles: ['admin'] },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

/** Creates a minimal guest fixture. */
function makeGuest(id: string) {
  return {
    id,
    invitationId: 'invitation-1',
    firstName: 'John',
    lastName: 'Doe',
    userId: null,
    type: 'adult' as const,
    attending: null,
    mealChoice: null,
    dietaryRestrictions: null,
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('updateInvitationVisibleEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should return Unauthorized when session is null', async () => {
    mockAuth.mockResolvedValue(null);

    const result = await updateInvitationVisibleEvents('invitation-1', []);

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  test('should return Unauthorized when session has no guestId', async () => {
    const session: Session = {
      user: { id: 'user-1' },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(session);

    const result = await updateInvitationVisibleEvents('invitation-1', []);

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  test('should allow admin session (roles: admin) to update visible events', async () => {
    mockAuth.mockResolvedValue(makeAdminSession());

    const mockDb = createMockDb({
      invitationFindFirst: vi.fn().mockResolvedValue({
        id: 'invitation-1',
        guests: [makeGuest('guest-1')],
      }),
    });

    mockGetDb.mockReturnValue(mockDb);

    const result = await updateInvitationVisibleEvents('invitation-1', [
      'event-uuid-1',
    ]);

    expect(result).toEqual({ success: true });
  });

  test('should return Unauthorized when session has guestId but no admin role', async () => {
    mockAuth.mockResolvedValue(makeSession('guest-1'));

    const result = await updateInvitationVisibleEvents('invitation-1', []);

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  test('should delete existing guestEvents rows and insert new ones for each guest', async () => {
    mockAuth.mockResolvedValue(makeAdminSession());

    const deleteWhereFn = vi.fn().mockResolvedValue(undefined);
    const deleteFn = vi.fn().mockReturnValue({ where: deleteWhereFn });
    const insertValuesFn = vi.fn().mockResolvedValue(undefined);
    const insertFn = vi.fn().mockReturnValue({ values: insertValuesFn });

    const mockDb = {
      query: {
        invitations: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'invitation-1',
            guests: [makeGuest('guest-1'), makeGuest('guest-2')],
          }),
        },
      },
      insert: insertFn,
      delete: deleteFn,
    } as unknown as DbClient;

    mockGetDb.mockReturnValue(mockDb);

    const result = await updateInvitationVisibleEvents('invitation-1', [
      'event-uuid-1',
      'event-uuid-2',
    ]);

    expect(result).toEqual({ success: true });

    // Should delete guestEvents rows for each guest
    expect(deleteFn).toHaveBeenCalledWith(guestEvents);
    expect(deleteWhereFn).toHaveBeenCalledTimes(2);

    // Should insert new guestEvents rows for each guest × eventId
    expect(insertFn).toHaveBeenCalledWith(guestEvents);
    expect(insertValuesFn).toHaveBeenCalledTimes(2);

    // Each insert call should cover both eventIds for that guest
    const insertCalls = insertValuesFn.mock.calls;

    expect(insertCalls[0][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          guestId: 'guest-1',
          eventId: 'event-uuid-1',
        }),
        expect.objectContaining({
          guestId: 'guest-1',
          eventId: 'event-uuid-2',
        }),
      ]),
    );
  });

  test('should handle empty eventIds by deleting all guestEvents rows for each guest', async () => {
    mockAuth.mockResolvedValue(makeAdminSession());

    const deleteWhereFn = vi.fn().mockResolvedValue(undefined);
    const deleteFn = vi.fn().mockReturnValue({ where: deleteWhereFn });
    const insertValuesFn = vi.fn().mockResolvedValue(undefined);
    const insertFn = vi.fn().mockReturnValue({ values: insertValuesFn });

    const mockDb = {
      query: {
        invitations: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'invitation-1',
            guests: [makeGuest('guest-1')],
          }),
        },
      },
      insert: insertFn,
      delete: deleteFn,
    } as unknown as DbClient;

    mockGetDb.mockReturnValue(mockDb);

    const result = await updateInvitationVisibleEvents('invitation-1', []);

    expect(result).toEqual({ success: true });

    // Should still delete existing rows even when no new events
    expect(deleteFn).toHaveBeenCalledWith(guestEvents);
    expect(deleteWhereFn).toHaveBeenCalledTimes(1);

    // Should not call insert when eventIds is empty
    expect(insertFn).not.toHaveBeenCalled();
  });

  test('should revalidate /admin/invitations and /schedule paths on success', async () => {
    mockAuth.mockResolvedValue(makeAdminSession());

    const mockDb = createMockDb({
      invitationFindFirst: vi.fn().mockResolvedValue({
        id: 'invitation-1',
        guests: [makeGuest('guest-1')],
      }),
    });

    mockGetDb.mockReturnValue(mockDb);

    await updateInvitationVisibleEvents('invitation-1', ['event-uuid-1']);

    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/invitations');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/schedule');
  });

  test('should return error when invitation is not found', async () => {
    mockAuth.mockResolvedValue(makeAdminSession());

    const mockDb = createMockDb({
      invitationFindFirst: vi.fn().mockResolvedValue(null),
    });

    mockGetDb.mockReturnValue(mockDb);

    const result = await updateInvitationVisibleEvents('invitation-1', []);

    expect(result).toEqual({
      success: false,
      error: expect.stringContaining('not found'),
    });
  });

  test('should return error when DB throws', async () => {
    mockAuth.mockResolvedValue(makeAdminSession());

    const mockDb = createMockDb({
      invitationFindFirst: vi.fn().mockRejectedValue(new Error('DB error')),
    });

    mockGetDb.mockReturnValue(mockDb);

    const result = await updateInvitationVisibleEvents('invitation-1', []);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
