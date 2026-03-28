/**
 * @vitest-environment node
 */

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  getAuthIdentity: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/db/repositories/invitations', () => ({
  findInvitationWithGuests: vi.fn(),
  updateInvitation: vi.fn(),
}));

import { expect, test, describe, beforeEach, vi } from 'vitest';
import { auth, getAuthIdentity } from '@/lib/auth';
import { getDb } from '@/lib/db';
import type { DbClient } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import {
  updateInvitationVisibleEvents,
  updateInvitationDetails,
} from './actions';
import { guestEvents, type Guest, type Invitation } from '@/lib/db/schema';
import { makeSession } from '@/tests/helpers';
import * as InvitationRepository from '@/lib/db/repositories/invitations';

const mockAuth = vi.mocked(auth);
const mockGetAuthIdentity = vi.mocked(getAuthIdentity);
const mockGetDb = vi.mocked(getDb);
const mockRevalidatePath = vi.mocked(revalidatePath);
const mockFindInvitationWithGuests = vi.mocked(
  InvitationRepository.findInvitationWithGuests,
);
const mockUpdateInvitation = vi.mocked(InvitationRepository.updateInvitation);

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

/** Creates a minimal guest fixture. */
function makeGuest(id: string): Guest {
  return {
    id,
    invitationId: 'invitation-1',
    firstName: 'John',
    lastName: 'Doe',
    userId: null,
    type: 'adult',
    attending: null,
    mealChoice: null,
    dietaryRestrictions: null,
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** Creates a minimal invitation with guests fixture. */
function makeInvitationWithGuests(
  id: string,
  guests: Guest[],
): Invitation & { guests: Guest[] } {
  return {
    id,
    guests,
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
    invitationCode: null,
    contactEmail: null,
    userId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('updateInvitationVisibleEvents', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('should return Unauthorized when session is null', async () => {
    mockAuth.mockResolvedValue(null);
    mockGetAuthIdentity.mockReturnValue(null);

    const result = await updateInvitationVisibleEvents('invitation-1', []);

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  test('should return Unauthorized when identity is null', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue(null);

    const result = await updateInvitationVisibleEvents('invitation-1', []);

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  test('should allow admin identity to update visible events', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    mockFindInvitationWithGuests.mockResolvedValue(
      makeInvitationWithGuests('invitation-1', [makeGuest('guest-1')]),
    );

    const mockDb = createMockDb();

    mockGetDb.mockReturnValue(mockDb);

    const result = await updateInvitationVisibleEvents('invitation-1', [
      'event-uuid-1',
    ]);

    expect(result).toEqual({ success: true });
  });

  test('should return Unauthorized when identity is a guest', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'invitation-1',
    });

    const result = await updateInvitationVisibleEvents('invitation-1', []);

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  test('should delete existing guestEvents rows and insert new ones for each guest', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    mockFindInvitationWithGuests.mockResolvedValue(
      makeInvitationWithGuests('invitation-1', [
        makeGuest('guest-1'),
        makeGuest('guest-2'),
      ]),
    );

    const deleteWhereFn = vi.fn().mockResolvedValue(undefined);
    const deleteFn = vi.fn().mockReturnValue({ where: deleteWhereFn });
    const insertValuesFn = vi.fn().mockResolvedValue(undefined);
    const insertFn = vi.fn().mockReturnValue({ values: insertValuesFn });

    const mockDb = {
      query: { invitations: { findFirst: vi.fn() } },
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
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    mockFindInvitationWithGuests.mockResolvedValue(
      makeInvitationWithGuests('invitation-1', [makeGuest('guest-1')]),
    );

    const deleteWhereFn = vi.fn().mockResolvedValue(undefined);
    const deleteFn = vi.fn().mockReturnValue({ where: deleteWhereFn });
    const insertValuesFn = vi.fn().mockResolvedValue(undefined);
    const insertFn = vi.fn().mockReturnValue({ values: insertValuesFn });

    const mockDb = {
      query: { invitations: { findFirst: vi.fn() } },
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
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    mockFindInvitationWithGuests.mockResolvedValue(
      makeInvitationWithGuests('invitation-1', [makeGuest('guest-1')]),
    );

    const mockDb = createMockDb();

    mockGetDb.mockReturnValue(mockDb);

    await updateInvitationVisibleEvents('invitation-1', ['event-uuid-1']);

    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/invitations');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/schedule');
  });

  test('should return error when invitation is not found', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });

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
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });

    const mockDb = createMockDb({
      invitationFindFirst: vi.fn().mockRejectedValue(new Error('DB error')),
    });

    mockGetDb.mockReturnValue(mockDb);

    const result = await updateInvitationVisibleEvents('invitation-1', []);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('updateInvitationDetails', () => {
  const validInput = {
    mailingAddress: 'The Smith Family',
    relationshipToCouple: 'Friends of Chris',
    totalInvited: 2,
    invitationCode: 'swift-panda',
    address: '123 Main St',
    addressLine2: 'Apt 1',
    city: 'Springfield',
    state: 'IL',
    zipCode: '62701',
    country: 'US',
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('should return Unauthorized when session is null', async () => {
    mockAuth.mockResolvedValue(null);
    mockGetAuthIdentity.mockReturnValue(null);

    const result = await updateInvitationDetails('invitation-1', validInput);

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  test('should return Unauthorized when identity is a guest', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'invitation-1',
    });

    const result = await updateInvitationDetails('invitation-1', validInput);

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  test('should return not found error when invitation does not exist', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    mockFindInvitationWithGuests.mockResolvedValue(undefined);

    const result = await updateInvitationDetails('invitation-1', validInput);

    expect(result).toEqual({ success: false, error: 'Invitation not found' });
  });

  test('should call updateInvitation with all fields and return success', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    mockFindInvitationWithGuests.mockResolvedValue(
      makeInvitationWithGuests('invitation-1', []),
    );
    mockUpdateInvitation.mockResolvedValue(undefined);

    const result = await updateInvitationDetails('invitation-1', validInput);

    expect(result).toEqual({ success: true });
    expect(mockUpdateInvitation).toHaveBeenCalledWith(
      'invitation-1',
      expect.objectContaining({
        mailingAddress: 'The Smith Family',
        relationshipToCouple: 'Friends of Chris',
        totalInvited: 2,
        invitationCode: 'swift-panda',
        address: '123 Main St',
        addressLine2: 'Apt 1',
        city: 'Springfield',
        state: 'IL',
        zipCode: '62701',
        country: 'US',
        updatedAt: expect.any(String),
      }),
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/invitations');
  });

  test('should return unique constraint error for duplicate invitation code', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    mockFindInvitationWithGuests.mockResolvedValue(
      makeInvitationWithGuests('invitation-1', []),
    );
    mockUpdateInvitation.mockRejectedValue(
      new Error('UNIQUE constraint failed: invitations.invitationCode'),
    );

    const result = await updateInvitationDetails('invitation-1', validInput);

    expect(result).toEqual({
      success: false,
      error: 'That invitation code is already in use',
    });
  });

  test('should return generic error for unexpected DB failures', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    mockFindInvitationWithGuests.mockResolvedValue(
      makeInvitationWithGuests('invitation-1', []),
    );
    mockUpdateInvitation.mockRejectedValue(new Error('disk quota exceeded'));

    const result = await updateInvitationDetails('invitation-1', validInput);

    expect(result).toEqual({
      success: false,
      error: 'Failed to update invitation',
    });
  });

  test('should throw Zod validation error before calling repository when mailingAddress is empty', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });

    await expect(
      updateInvitationDetails('invitation-1', {
        ...validInput,
        mailingAddress: '',
      }),
    ).rejects.toThrow();

    expect(mockFindInvitationWithGuests).not.toHaveBeenCalled();
    expect(mockUpdateInvitation).not.toHaveBeenCalled();
  });
});
