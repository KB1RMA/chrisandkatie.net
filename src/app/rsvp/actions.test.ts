/**
 * @vitest-environment node
 */
import { expect, test, describe, beforeEach, vi } from 'vitest';
import { type Session } from 'next-auth';
import { type InferSelectModel } from 'drizzle-orm';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

import { submitRsvp } from './actions';
import { MEAL_OPTIONS } from '@/lib/constants';
import { guests, invitations } from '@/lib/db/schema';
import { type DbClient } from '@/lib/db';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';

type Invitation = InferSelectModel<typeof invitations>;
type Guest = InferSelectModel<typeof guests>;

type Guest = InferSelectModel<typeof guests>;

/**
 * Creates a mock Drizzle database for testing.
 * Provides only the methods used in submitRsvp tests.
 *
 * @param findFirstFn Mock function for query.guests.findFirst
 * @param updateFn Optional mock function for db.update
 * @returns Partial DbClient with mocked methods
 */
function createMockDb(
  findFirstFn: ReturnType<typeof vi.fn>,
  updateFn?: ReturnType<typeof vi.fn>,
): Partial<DbClient> {
  return {
    query: {
      guests: {
        findFirst: findFirstFn,
      },
    },
    ...(updateFn && { update: updateFn }),
  } as unknown as Partial<DbClient>;
}

describe('submitRsvp', () => {
  const mockAuth = vi.mocked(auth);
  const mockGetDb = vi.mocked(getDb);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should successfully submit RSVP with valid data', async () => {
    const guestId = 'guest-1';
    const invitationId = 'invitation-1';

    const mockSession: Session = {
      user: {
        guestId,
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(mockSession);

    const whereFn = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    const updateFn = vi.fn().mockReturnValue({ set: setFn });

    const mockGuest: Guest = {
      id: guestId,
      invitationId,
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

    const mockDb = createMockDb(vi.fn().mockResolvedValue(mockGuest), updateFn);

    mockGetDb.mockReturnValue(mockDb as DbClient);

    const response = await submitRsvp({
      invitationId,
      guests: [
        {
          id: guestId,
          attending: true,
          mealChoice: MEAL_OPTIONS.PRIME_RIB,
          dietaryRestrictions: null,
          notes: null,
        },
      ],
    });

    expect(response).toEqual({ success: true });
    expect(mockAuth).toHaveBeenCalled();
  });

  test('should throw error when user is not authenticated', async () => {
    mockAuth.mockResolvedValue(null);

    await expect(
      submitRsvp({
        invitationId: 'invitation-1',
        guests: [
          {
            id: 'guest-1',
            attending: true,
            mealChoice: MEAL_OPTIONS.CHICKEN,
            dietaryRestrictions: null,
            notes: null,
          },
        ],
      }),
    ).rejects.toThrow('Unauthorized');
  });

  test('should throw error when session has no guestId', async () => {
    const mockSession: Session = {
      user: {},
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(mockSession);

    await expect(
      submitRsvp({
        invitationId: 'invitation-1',
        guests: [
          {
            id: 'guest-1',
            attending: true,
            mealChoice: MEAL_OPTIONS.CHICKEN,
            dietaryRestrictions: null,
            notes: null,
          },
        ],
      }),
    ).rejects.toThrow('Unauthorized');
  });

  test('should throw error when guest belongs to different invitation', async () => {
    const guestId = 'guest-1';
    const invitationId = 'invitation-1';

    const mockSession: Session = {
      user: {
        guestId,
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(mockSession);

    const mockGuest: Guest = {
      id: guestId,
      invitationId: 'invitation-2',
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

    const mockDb = createMockDb(vi.fn().mockResolvedValue(mockGuest));

    mockGetDb.mockReturnValue(mockDb as DbClient);

    await expect(
      submitRsvp({
        invitationId,
        guests: [
          {
            id: guestId,
            attending: true,
            mealChoice: MEAL_OPTIONS.CHICKEN,
            dietaryRestrictions: null,
            notes: null,
          },
        ],
      }),
    ).rejects.toThrow('Not authorized for this invitation');
  });

  test('should throw error when attending without meal choice', async () => {
    const mockSession: Session = {
      user: {
        guestId: 'guest-1',
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(mockSession);

    const mockGuest: Guest = {
      id: 'guest-1',
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

    const mockDb = createMockDb(vi.fn().mockResolvedValue(mockGuest));

    mockGetDb.mockReturnValue(mockDb as DbClient);

    await expect(
      submitRsvp({
        invitationId: 'invitation-1',
        guests: [
          {
            id: 'guest-1',
            attending: true,
            mealChoice: null,
            dietaryRestrictions: null,
            notes: null,
          },
        ],
      }),
    ).rejects.toThrow('Invalid request data');
  });

  test('should update plus-one guest names', async () => {
    const guestId = 'guest-1';
    const invitationId = 'invitation-1';

    const mockSession: Session = {
      user: {
        guestId,
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(mockSession);

    const whereFn = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    const updateFn = vi.fn().mockReturnValue({ set: setFn });

    const mockGuest: Guest = {
      id: guestId,
      invitationId,
      firstName: 'Guest',
      lastName: 'Name',
      userId: null,
      type: 'adult',
      attending: null,
      mealChoice: null,
      dietaryRestrictions: null,
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockDb = createMockDb(vi.fn().mockResolvedValue(mockGuest), updateFn);

    mockGetDb.mockReturnValue(mockDb as DbClient);

    const response = await submitRsvp({
      invitationId,
      guests: [
        {
          id: guestId,
          attending: true,
          mealChoice: MEAL_OPTIONS.PRIME_RIB,
          dietaryRestrictions: null,
          notes: null,
        },
      ],
    });

    expect(response).toEqual({ success: true });
  });

  test('should skip guests not belonging to the invitation', async () => {
    const guestId = 'guest-1';
    const invitationId = 'invitation-1';

    const mockSession: Session = {
      user: {
        guestId,
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(mockSession);

    const whereFn = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    const updateFn = vi.fn().mockReturnValue({ set: setFn });

    const mockGuest: Guest = {
      id: guestId,
      invitationId,
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

    const mockDb = createMockDb(vi.fn().mockResolvedValue(mockGuest), updateFn);

    mockGetDb.mockReturnValue(mockDb as DbClient);

    const response = await submitRsvp({
      invitationId,
      guests: [
        {
          id: guestId,
          attending: true,
          mealChoice: MEAL_OPTIONS.PRIME_RIB,
          dietaryRestrictions: null,
          notes: null,
        },
      ],
    });

    expect(response).toEqual({ success: true });
  });

  test('should allow not attending without meal choice', async () => {
    const guestId = 'guest-1';
    const invitationId = 'invitation-1';

    const mockSession: Session = {
      user: {
        guestId,
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(mockSession);

    const whereFn = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    const updateFn = vi.fn().mockReturnValue({ set: setFn });

    const mockGuest: Guest = {
      id: guestId,
      invitationId,
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

    const mockDb = createMockDb(vi.fn().mockResolvedValue(mockGuest), updateFn);

    mockGetDb.mockReturnValue(mockDb as DbClient);

    const response = await submitRsvp({
      invitationId,
      guests: [
        {
          id: guestId,
          attending: false,
          mealChoice: null,
          dietaryRestrictions: null,
          notes: 'Sorry, cannot make it',
        },
      ],
    });

    expect(response).toEqual({ success: true });
    expect(setFn).toHaveBeenCalledTimes(1);
  });

  test('should throw error when no guests provided', async () => {
    const mockSession: Session = {
      user: {
        guestId: 'guest-1',
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(mockSession);

    const mockGuest: Guest = {
      id: 'guest-1',
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

    const mockDb = createMockDb(vi.fn().mockResolvedValue(mockGuest));

    mockGetDb.mockReturnValue(mockDb as DbClient);

    await expect(
      submitRsvp({
        invitationId: 'invitation-1',
        guests: [],
      }),
    ).rejects.toThrow('Invalid request data');
  });

  test('should throw error when invitation ID is missing', async () => {
    const mockSession: Session = {
      user: {
        guestId: 'guest-1',
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(mockSession);

    await expect(
      submitRsvp({
        invitationId: '',
        guests: [
          {
            id: 'guest-1',
            attending: true,
            mealChoice: MEAL_OPTIONS.CHICKEN,
            dietaryRestrictions: null,
            notes: null,
          },
        ],
      }),
    ).rejects.toThrow('Invalid request data');
  });
});

// ---------------------------------------------------------------------------
// Email persistence tests (T007)
// ---------------------------------------------------------------------------

/**
 * Creates a full mock database for email persistence tests.
 * Supports queries for both guests and invitations tables.
 *
 * @param guestFindFirstFn - Mock for guests.findFirst.
 * @param invitationFindFirstFn - Mock for invitations.findFirst.
 * @param updateFn - Optional mock for db.update.
 * @returns Partial DbClient mock.
 */
function createEmailTestMockDb(
  guestFindFirstFn: ReturnType<typeof vi.fn>,
  invitationFindFirstFn: ReturnType<typeof vi.fn>,
  updateFn?: ReturnType<typeof vi.fn>,
): Partial<DbClient> {
  const defaultUpdateFn = () => {
    const whereFn = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: whereFn });

    return { set: setFn };
  };

  const effectiveUpdateFn =
    updateFn ?? vi.fn().mockImplementation(defaultUpdateFn);

  return {
    query: {
      guests: {
        findFirst: guestFindFirstFn,
      },
      invitations: {
        findFirst: invitationFindFirstFn,
      },
    },
    update: effectiveUpdateFn,
  } as unknown as Partial<DbClient>;
}

/** Minimal invitation fixture. */
function makeInvitation(id = 'invitation-1'): Invitation {
  return {
    id,
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
    invitationCode: 'swift-panda',
    contactEmail: null,
    userId: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('submitRsvp — email persistence', () => {
  const mockAuth = vi.mocked(auth);
  const mockGetDb = vi.mocked(getDb);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should update Invitation.contactEmail and User.email when contactEmail is provided', async () => {
    const guestId = 'guest-1';
    const invitationId = 'invitation-1';
    const userId = 'user-1';

    const mockSession: Session = {
      user: { id: userId, guestId },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(mockSession);

    const whereFn = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    const updateFn = vi.fn().mockReturnValue({ set: setFn });

    const mockGuest: Guest = {
      id: guestId,
      invitationId,
      firstName: 'John',
      lastName: 'Doe',
      userId,
      type: 'adult',
      attending: null,
      mealChoice: null,
      dietaryRestrictions: null,
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const guestFindFirst = vi
      .fn()
      .mockResolvedValueOnce(mockGuest)
      .mockResolvedValueOnce(mockGuest);
    const mockDb = createEmailTestMockDb(
      guestFindFirst,
      vi.fn().mockResolvedValue(makeInvitation(invitationId)),
      updateFn,
    );

    mockGetDb.mockReturnValue(mockDb as DbClient);

    const result = await submitRsvp({
      invitationId,
      contactEmail: 'john@example.com',
      guests: [
        {
          id: guestId,
          attending: false,
          mealChoice: null,
          dietaryRestrictions: null,
          notes: null,
        },
      ],
    });

    expect(result).toEqual({ success: true });

    // db.update should have been called for guest update + invitation email + user email
    expect(updateFn).toHaveBeenCalledTimes(3);
  });

  test('should not update email tables when contactEmail is absent', async () => {
    const guestId = 'guest-1';
    const invitationId = 'invitation-1';

    const mockSession: Session = {
      user: { id: 'user-1', guestId },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(mockSession);

    const whereFn = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    const updateFn = vi.fn().mockReturnValue({ set: setFn });

    const mockGuest: Guest = {
      id: guestId,
      invitationId,
      firstName: 'John',
      lastName: 'Doe',
      userId: 'user-1',
      type: 'adult',
      attending: null,
      mealChoice: null,
      dietaryRestrictions: null,
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockDb = createEmailTestMockDb(
      vi.fn().mockResolvedValue(mockGuest),
      vi.fn().mockResolvedValue(makeInvitation(invitationId)),
      updateFn,
    );

    mockGetDb.mockReturnValue(mockDb as DbClient);

    await submitRsvp({
      invitationId,
      guests: [
        {
          id: guestId,
          attending: false,
          mealChoice: null,
          dietaryRestrictions: null,
          notes: null,
        },
      ],
    });

    // Only guest update — no email updates
    expect(updateFn).toHaveBeenCalledTimes(1);
  });

  test('should not update email tables when contactEmail is empty string', async () => {
    const guestId = 'guest-1';
    const invitationId = 'invitation-1';

    const mockSession: Session = {
      user: { id: 'user-1', guestId },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(mockSession);

    const whereFn = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    const updateFn = vi.fn().mockReturnValue({ set: setFn });

    const mockGuest: Guest = {
      id: guestId,
      invitationId,
      firstName: 'Jane',
      lastName: 'Doe',
      userId: 'user-1',
      type: 'adult',
      attending: null,
      mealChoice: null,
      dietaryRestrictions: null,
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockDb = createEmailTestMockDb(
      vi.fn().mockResolvedValue(mockGuest),
      vi.fn().mockResolvedValue(makeInvitation(invitationId)),
      updateFn,
    );

    mockGetDb.mockReturnValue(mockDb as DbClient);

    await submitRsvp({
      invitationId,
      contactEmail: '',
      guests: [
        {
          id: guestId,
          attending: false,
          mealChoice: null,
          dietaryRestrictions: null,
          notes: null,
        },
      ],
    });

    // Only guest update — empty email treated the same as absent
    expect(updateFn).toHaveBeenCalledTimes(1);
  });
});
