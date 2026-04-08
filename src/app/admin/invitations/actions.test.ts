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
  createGuest: vi.fn(),
  deleteGuest: vi.fn(),
}));

vi.mock('@/lib/db/repositories/rsvpResponses', () => ({
  deleteRsvpResponsesByGuestIds: vi.fn(),
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
  addGuestToInvitation,
  removeGuestFromInvitation,
} from './actions';
import { guestEvents, type Guest, type Invitation } from '@/lib/db/schema';
import { makeSession } from '@/tests/helpers';
import * as InvitationRepository from '@/lib/db/repositories/invitations';
import * as GuestRepository from '@/lib/db/repositories/guests';
import * as RsvpRepository from '@/lib/db/repositories/rsvpResponses';
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
const mockDeleteRsvpResponsesByGuestIds = vi.mocked(
  RsvpRepository.deleteRsvpResponsesByGuestIds,
);
const mockUpdateGuestFields = vi.mocked(GuestRepository.updateGuestFields);
const mockFindGuestById = vi.mocked(GuestRepository.findGuestById);
const mockCreateGuest = vi.mocked(GuestRepository.createGuest);
const mockDeleteGuest = vi.mocked(GuestRepository.deleteGuest);
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
    mockDeleteRsvpResponsesByGuestIds.mockResolvedValue(undefined);
    mockResetGuestRsvpFields.mockResolvedValue(undefined);

    const result = await resetInvitationRSVP('invitation-1');

    expect(result).toEqual({ success: true });
    expect(mockDeleteRsvpResponsesByGuestIds).toHaveBeenCalledExactlyOnceWith([
      'guest-1',
      'guest-2',
    ]);
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

// ---------------------------------------------------------------------------
// addGuestToInvitation
// ---------------------------------------------------------------------------

const VALID_INVITATION_UUID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const VALID_GUEST_UUID = 'c3d4e5f6-a7b8-4012-8def-123456789012';

/**
 * Creates a mock DB that supports findGuestEventsForGuestIds and insertGuestEvents.
 *
 * @param guestEventRows - Rows to return from guestEvents.findMany.
 * @param insertValuesFn - Optional override for the insert values spy.
 * @returns Partial DbClient supporting the guestEvents queries used by addGuestToInvitation.
 */
function createMockDbForGuestActions(
  guestEventRows: Array<{ guestId: string; eventId: string }> = [],
  insertValuesFn: ReturnType<typeof vi.fn> = vi
    .fn()
    .mockResolvedValue(undefined),
): DbClient {
  return {
    query: {
      guestEvents: {
        findMany: vi.fn().mockResolvedValue(guestEventRows),
      },
    },
    insert: vi.fn().mockReturnValue({ values: insertValuesFn }),
  } as unknown as DbClient;
}

describe('addGuestToInvitation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const validInput = {
    invitationId: VALID_INVITATION_UUID,
    firstName: 'Jane',
    lastName: 'Smith',
    type: 'adult' as const,
  };

  test('should return Invalid input when input fails schema validation', async () => {
    const result = await addGuestToInvitation({ invitationId: 'not-a-uuid' });

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/.+/),
    });
  });

  test('should return Unauthorized when session has no admin identity', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue(null);

    const result = await addGuestToInvitation(validInput);

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  test('should return Unauthorized when identity is a guest', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: VALID_INVITATION_UUID,
    });

    const result = await addGuestToInvitation(validInput);

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  test('should return Invitation not found when invitation does not exist', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    mockFindInvitationWithGuests.mockResolvedValue(undefined);

    const result = await addGuestToInvitation(validInput);

    expect(result).toEqual({ success: false, error: 'Invitation not found' });
  });

  test('should return success when input is valid and user is admin', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    mockFindInvitationWithGuests.mockResolvedValue(
      makeInvitationWithGuests(VALID_INVITATION_UUID, [makeGuest('guest-1')]),
    );
    mockCreateGuest.mockResolvedValue(undefined);
    mockUpdateInvitation.mockResolvedValue(undefined);
    mockGetDb.mockReturnValue(createMockDbForGuestActions([]));

    const result = await addGuestToInvitation(validInput);

    expect(result).toEqual({ success: true });
    expect(mockCreateGuest).toHaveBeenCalledOnce();
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/invitations');
  });

  test('should increment totalInvited when new guest count exceeds the current total', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    // invitation has totalInvited=1 but already has 1 guest — adding makes 2
    const invitation = {
      ...makeInvitationWithGuests(VALID_INVITATION_UUID, [
        makeGuest('guest-1'),
      ]),
      totalInvited: 1,
    };

    mockFindInvitationWithGuests.mockResolvedValue(invitation);
    mockCreateGuest.mockResolvedValue(undefined);
    mockUpdateInvitation.mockResolvedValue(undefined);
    mockGetDb.mockReturnValue(createMockDbForGuestActions([]));

    await addGuestToInvitation(validInput);

    expect(mockUpdateInvitation).toHaveBeenCalledWith(
      VALID_INVITATION_UUID,
      expect.objectContaining({ totalInvited: 2 }),
    );
  });

  test('should inherit event IDs from existing guests guestEvents', async () => {
    const existingGuest = makeGuest('guest-1');
    const inheritedEventRows = [
      { guestId: 'guest-1', eventId: 'event-uuid-1' },
      { guestId: 'guest-1', eventId: 'event-uuid-2' },
    ];
    const insertValuesFn = vi.fn().mockResolvedValue(undefined);

    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    mockFindInvitationWithGuests.mockResolvedValue(
      makeInvitationWithGuests(VALID_INVITATION_UUID, [existingGuest]),
    );
    mockCreateGuest.mockResolvedValue(undefined);
    mockGetDb.mockReturnValue(
      createMockDbForGuestActions(inheritedEventRows, insertValuesFn),
    );

    await addGuestToInvitation(validInput);

    expect(insertValuesFn).toHaveBeenCalledExactlyOnceWith(
      expect.arrayContaining([
        expect.objectContaining({ eventId: 'event-uuid-1' }),
        expect.objectContaining({ eventId: 'event-uuid-2' }),
      ]),
    );
  });
  test('should not update totalInvited when it already exceeds the new guest count after adding', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    // invitation has totalInvited=5 with only 1 guest — adding one stays within the limit
    const invitation = {
      ...makeInvitationWithGuests(VALID_INVITATION_UUID, [
        makeGuest('guest-1'),
      ]),
      totalInvited: 5,
    };

    mockFindInvitationWithGuests.mockResolvedValue(invitation);
    mockCreateGuest.mockResolvedValue(undefined);
    mockUpdateInvitation.mockResolvedValue(undefined);
    mockGetDb.mockReturnValue(createMockDbForGuestActions([]));

    await addGuestToInvitation(validInput);

    expect(mockUpdateInvitation).not.toHaveBeenCalled();
  });
});

describe('removeGuestFromInvitation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const validInput = {
    guestId: VALID_GUEST_UUID,
    invitationId: VALID_INVITATION_UUID,
  };

  test('should return Invalid input when input fails schema validation', async () => {
    const result = await removeGuestFromInvitation({
      guestId: '',
      invitationId: '',
    });

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/.+/),
    });
  });

  test('should return Unauthorized when not admin', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue(null);

    const result = await removeGuestFromInvitation(validInput);

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  test('should return Unauthorized when identity is a guest', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: VALID_INVITATION_UUID,
    });

    const result = await removeGuestFromInvitation(validInput);

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
  });

  test('should return Invitation not found when invitation missing', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    mockFindInvitationWithGuests.mockResolvedValue(undefined);

    const result = await removeGuestFromInvitation(validInput);

    expect(result).toEqual({ success: false, error: 'Invitation not found' });
  });

  test('should return error when invitation has exactly one guest', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    mockFindInvitationWithGuests.mockResolvedValue(
      makeInvitationWithGuests(VALID_INVITATION_UUID, [
        makeGuest(VALID_GUEST_UUID),
      ]),
    );

    const result = await removeGuestFromInvitation(validInput);

    expect(result).toEqual({
      success: false,
      error: 'Cannot remove the last guest from an invitation',
    });
    expect(mockDeleteGuest).not.toHaveBeenCalled();
  });

  test('should return error when guestId does not belong to the invitation', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    // The invitation has two guests, but neither matches VALID_GUEST_UUID
    mockFindInvitationWithGuests.mockResolvedValue(
      makeInvitationWithGuests(VALID_INVITATION_UUID, [
        makeGuest('guest-1'),
        makeGuest('guest-2'),
      ]),
    );

    const result = await removeGuestFromInvitation(validInput);

    expect(result).toEqual({
      success: false,
      error: 'Guest not found on this invitation',
    });
    expect(mockDeleteGuest).not.toHaveBeenCalled();
  });

  test('should return success when input is valid, invitation exists, and guest count > 1', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    mockFindInvitationWithGuests.mockResolvedValue(
      makeInvitationWithGuests(VALID_INVITATION_UUID, [
        makeGuest(VALID_GUEST_UUID),
        makeGuest('guest-2'),
      ]),
    );
    mockDeleteGuest.mockResolvedValue(undefined);
    mockUpdateInvitation.mockResolvedValue(undefined);

    const result = await removeGuestFromInvitation(validInput);

    expect(result).toEqual({ success: true });
    expect(mockDeleteGuest).toHaveBeenCalledWith(VALID_GUEST_UUID);
    expect(mockUpdateInvitation).toHaveBeenCalledWith(
      VALID_INVITATION_UUID,
      expect.objectContaining({ totalInvited: 1 }),
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/invitations');
  });

  test('should always sync totalInvited to the new guest count after removal', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
    // invitation has a higher totalInvited than guest count — should still be set to new count
    const invitation = {
      ...makeInvitationWithGuests(VALID_INVITATION_UUID, [
        makeGuest(VALID_GUEST_UUID),
        makeGuest('guest-2'),
      ]),
      totalInvited: 5,
    };

    mockFindInvitationWithGuests.mockResolvedValue(invitation);
    mockDeleteGuest.mockResolvedValue(undefined);
    mockUpdateInvitation.mockResolvedValue(undefined);

    await removeGuestFromInvitation(validInput);

    expect(mockUpdateInvitation).toHaveBeenCalledWith(
      VALID_INVITATION_UUID,
      expect.objectContaining({ totalInvited: 1 }),
    );
  });
});
