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

import { submitRsvp, checkEmailAvailability } from './actions';
import { MEAL_OPTIONS } from '@/lib/constants';
import { guests } from '@/lib/db/schema';
import { type DbClient } from '@/lib/db';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';

type Guest = InferSelectModel<typeof guests>;

/**
 * Creates a mock Drizzle database for testing.
 * Provides only the methods used in submitRsvp tests.
 *
 * @param findFirstGuestFn Mock function for query.guests.findFirst
 * @param updateFn Optional mock function for db.update
 * @param findFirstUserFn Optional mock function for query.users.findFirst
 * @returns Partial DbClient with mocked methods
 */
function createMockDb(
  findFirstGuestFn: ReturnType<typeof vi.fn>,
  updateFn?: ReturnType<typeof vi.fn>,
  findFirstUserFn?: ReturnType<typeof vi.fn>,
): Partial<DbClient> {
  return {
    query: {
      guests: {
        findFirst: findFirstGuestFn,
      },
      users: {
        findFirst: findFirstUserFn ?? vi.fn().mockResolvedValue(null),
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

  test('should throw error when email is already in use', async () => {
    const guestId = 'guest-1';
    const invitationId = 'invitation-1';
    const userId = 'user-1';

    const mockSession: Session = {
      user: { guestId },
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

    const mockDb = createMockDb(
      vi.fn().mockResolvedValue(mockGuest),
      updateFn,
      vi
        .fn()
        .mockResolvedValue({ id: 'other-user', email: 'taken@example.com' }),
    );

    mockGetDb.mockReturnValue(mockDb as DbClient);

    await expect(
      submitRsvp({
        invitationId,
        email: 'taken@example.com',
        guests: [
          {
            id: guestId,
            attending: true,
            mealChoice: MEAL_OPTIONS.PRIME_RIB,
            dietaryRestrictions: null,
            notes: null,
          },
        ],
      }),
    ).rejects.toThrow('Email address is already in use');
  });
});

describe('checkEmailAvailability', () => {
  const mockAuth = vi.mocked(auth);
  const mockGetDb = vi.mocked(getDb);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should throw error when user is not authenticated', async () => {
    mockAuth.mockResolvedValue(null);

    await expect(checkEmailAvailability('test@example.com')).rejects.toThrow(
      'Unauthorized',
    );
  });

  test('should return available true when email is not taken', async () => {
    const guestId = 'guest-1';

    const mockSession: Session = {
      user: { guestId },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(mockSession);

    const mockGuest: Guest = {
      id: guestId,
      invitationId: 'invitation-1',
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

    const mockDb = createMockDb(
      vi.fn().mockResolvedValue(mockGuest),
      undefined,
      vi.fn().mockResolvedValue(null),
    );

    mockGetDb.mockReturnValue(mockDb as DbClient);

    const result = await checkEmailAvailability('free@example.com');

    expect(result).toEqual({ available: true });
  });

  test('should return available false when email is already taken', async () => {
    const guestId = 'guest-1';

    const mockSession: Session = {
      user: { guestId },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(mockSession);

    const mockGuest: Guest = {
      id: guestId,
      invitationId: 'invitation-1',
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

    const mockDb = createMockDb(
      vi.fn().mockResolvedValue(mockGuest),
      undefined,
      vi
        .fn()
        .mockResolvedValue({ id: 'other-user', email: 'taken@example.com' }),
    );

    mockGetDb.mockReturnValue(mockDb as DbClient);

    const result = await checkEmailAvailability('taken@example.com');

    expect(result).toEqual({ available: false });
  });

  test('should return available true when guest has no userId', async () => {
    const guestId = 'guest-1';

    const mockSession: Session = {
      user: { guestId },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(mockSession);

    const mockGuest: Guest = {
      id: guestId,
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

    const result = await checkEmailAvailability('any@example.com');

    expect(result).toEqual({ available: true });
  });
});
