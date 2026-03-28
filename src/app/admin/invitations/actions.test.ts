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
  findInvitationsWithoutCode: vi.fn(),
}));

vi.mock('@/lib/db/repositories/guests', () => ({
  resetGuestRsvpFields: vi.fn(),
  updateGuestFields: vi.fn(),
  findGuestById: vi.fn(),
}));

vi.mock('@/lib/invitation-code', () => ({
  generateUniqueInvitationCode: vi.fn(),
}));

import { expect, test, describe, beforeEach, vi } from 'vitest';
import { auth, getAuthIdentity } from '@/lib/auth';
import { getDb } from '@/lib/db';
import type { DbClient } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import {
  updateInvitationVisibleEvents,
  updateInvitationDetails,
  backfillInvitationCodes,
  resetInvitationRSVP,
  updateGuestType,
} from './actions';
import { guestEvents, type Guest, type Invitation } from '@/lib/db/schema';
import { makeSession } from '@/tests/helpers';
import * as InvitationRepository from '@/lib/db/repositories/invitations';
import * as GuestRepository from '@/lib/db/repositories/guests';
import { generateUniqueInvitationCode } from '@/lib/invitation-code';

const mockAuth = vi.mocked(auth);
const mockGetAuthIdentity = vi.mocked(getAuthIdentity);
const mockGetDb = vi.mocked(getDb);
const mockRevalidatePath = vi.mocked(revalidatePath);
const mockFindInvitationWithGuests = vi.mocked(
  InvitationRepository.findInvitationWithGuests,
);
const mockUpdateInvitation = vi.mocked(InvitationRepository.updateInvitation);
const mockFindInvitationsWithoutCode = vi.mocked(
  InvitationRepository.findInvitationsWithoutCode,
);
const mockResetGuestRsvpFields = vi.mocked(
  GuestRepository.resetGuestRsvpFields,
);
const mockUpdateGuestFields = vi.mocked(GuestRepository.updateGuestFields);
const mockFindGuestById = vi.mocked(GuestRepository.findGuestById);
const mockGenerateUniqueInvitationCode = vi.mocked(
  generateUniqueInvitationCode,
);

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

describe('backfillInvitationCodes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('should return Unauthorized when session is null', async () => {
    mockAuth.mockResolvedValue(null);
    mockGetAuthIdentity.mockReturnValue(null);

    const result = await backfillInvitationCodes();

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  test('should return Unauthorized when identity is a guest', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'invitation-1',
    });

    const result = await backfillInvitationCodes();

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  test('should return updatedCount 0 when no invitations are pending', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    mockGetDb.mockReturnValue(createMockDb());
    mockFindInvitationsWithoutCode.mockResolvedValue([]);

    const result = await backfillInvitationCodes();

    expect(result).toEqual({ success: true, updatedCount: 0 });
    expect(mockGenerateUniqueInvitationCode).not.toHaveBeenCalled();
  });

  test('should assign a code to each pending invitation and return updatedCount', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    mockGetDb.mockReturnValue(createMockDb());
    mockFindInvitationsWithoutCode.mockResolvedValue([
      { id: 'inv-1', invitationCode: null },
      { id: 'inv-2', invitationCode: null },
    ]);
    mockGenerateUniqueInvitationCode
      .mockResolvedValueOnce('swift-panda')
      .mockResolvedValueOnce('lazy-tiger');
    mockUpdateInvitation.mockResolvedValue(undefined);

    const result = await backfillInvitationCodes();

    expect(result).toEqual({ success: true, updatedCount: 2 });
    expect(mockUpdateInvitation).toHaveBeenCalledTimes(2);
    expect(mockUpdateInvitation).toHaveBeenCalledWith(
      'inv-1',
      expect.objectContaining({ invitationCode: 'swift-panda' }),
    );
    expect(mockUpdateInvitation).toHaveBeenCalledWith(
      'inv-2',
      expect.objectContaining({ invitationCode: 'lazy-tiger' }),
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/invitations');
  });

  test('should return error when DB throws', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    mockGetDb.mockReturnValue(createMockDb());
    mockFindInvitationsWithoutCode.mockRejectedValue(new Error('DB error'));

    const result = await backfillInvitationCodes();

    expect(result).toEqual({
      success: false,
      error: 'Failed to backfill invitation codes',
    });
  });
});

describe('resetInvitationRSVP', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('should return Unauthorized when session is null', async () => {
    mockAuth.mockResolvedValue(null);
    mockGetAuthIdentity.mockReturnValue(null);

    const result = await resetInvitationRSVP('invitation-1');

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  test('should return Unauthorized when identity is a guest', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'invitation-1',
    });

    const result = await resetInvitationRSVP('invitation-1');

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  test('should return not found error when invitation does not exist', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    mockFindInvitationWithGuests.mockResolvedValue(undefined);

    const result = await resetInvitationRSVP('invitation-1');

    expect(result).toEqual({ success: false, error: 'Invitation not found' });
  });

  test('should reset RSVP fields for all guests and revalidate paths', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    mockFindInvitationWithGuests.mockResolvedValue(
      makeInvitationWithGuests('invitation-1', [
        makeGuest('guest-1'),
        makeGuest('guest-2'),
      ]),
    );
    mockResetGuestRsvpFields.mockResolvedValue(undefined);

    const result = await resetInvitationRSVP('invitation-1');

    expect(result).toEqual({ success: true });
    expect(mockResetGuestRsvpFields).toHaveBeenCalledTimes(2);
    expect(mockResetGuestRsvpFields).toHaveBeenCalledWith(
      'guest-1',
      expect.any(String),
    );
    expect(mockResetGuestRsvpFields).toHaveBeenCalledWith(
      'guest-2',
      expect.any(String),
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/invitations');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/guests');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/rsvp');
  });

  test('should return error when DB throws', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    mockFindInvitationWithGuests.mockRejectedValue(new Error('DB error'));

    const result = await resetInvitationRSVP('invitation-1');

    expect(result).toEqual({ success: false, error: 'Failed to reset RSVP' });
  });
});

describe('updateGuestType', () => {
  const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('should return invalid input error when guestId is not a UUID', async () => {
    const result = await updateGuestType('not-a-uuid', 'adult');

    expect(result).toEqual({ success: false, error: 'Invalid input' });
    expect(mockFindGuestById).not.toHaveBeenCalled();
    expect(mockUpdateGuestFields).not.toHaveBeenCalled();
  });

  test('should return invalid input error when type is not adult or child', async () => {
    const result = await updateGuestType(
      VALID_UUID,
      'teenager' as 'adult' | 'child',
    );

    expect(result).toEqual({ success: false, error: 'Invalid input' });
    expect(mockUpdateGuestFields).not.toHaveBeenCalled();
  });

  test('should return Unauthorized when session is null', async () => {
    mockAuth.mockResolvedValue(null);
    mockGetAuthIdentity.mockReturnValue(null);

    const result = await updateGuestType(VALID_UUID, 'adult');

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  test('should return Unauthorized when identity is a guest', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'invitation-1',
    });

    const result = await updateGuestType(VALID_UUID, 'adult');

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  test('should return guest not found error when guestId does not exist', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    mockFindGuestById.mockResolvedValue(undefined);

    const result = await updateGuestType(VALID_UUID, 'adult');

    expect(result).toEqual({ success: false, error: 'Guest not found' });
    expect(mockUpdateGuestFields).not.toHaveBeenCalled();
  });

  test('should update guest type to adult and revalidate both admin paths', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    mockFindGuestById.mockResolvedValue(makeGuest(VALID_UUID));
    mockUpdateGuestFields.mockResolvedValue(undefined);

    const result = await updateGuestType(VALID_UUID, 'adult');

    expect(result).toEqual({ success: true });
    expect(mockUpdateGuestFields).toHaveBeenCalledWith(
      VALID_UUID,
      expect.objectContaining({ type: 'adult' }),
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/invitations');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/guests');
  });

  test('should update guest type to child and return success', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    mockFindGuestById.mockResolvedValue(makeGuest(VALID_UUID));
    mockUpdateGuestFields.mockResolvedValue(undefined);

    const result = await updateGuestType(VALID_UUID, 'child');

    expect(result).toEqual({ success: true });
    expect(mockUpdateGuestFields).toHaveBeenCalledWith(
      VALID_UUID,
      expect.objectContaining({ type: 'child' }),
    );
  });

  test('should return error when DB throws', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    mockFindGuestById.mockResolvedValue(makeGuest(VALID_UUID));
    mockUpdateGuestFields.mockRejectedValue(new Error('DB error'));

    const result = await updateGuestType(VALID_UUID, 'adult');

    expect(result).toEqual({
      success: false,
      error: 'Failed to update guest type',
    });
  });
});
