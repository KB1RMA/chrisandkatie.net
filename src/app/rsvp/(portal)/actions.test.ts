/**
 * @vitest-environment node
 */
import { expect, test, describe, beforeEach, vi } from 'vitest';
import { type InferSelectModel } from 'drizzle-orm';
import { makeSession } from '@/tests/helpers';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  getAuthIdentity: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn(),
}));

import {
  submitRsvp,
  fetchGuestEvents,
  updateInvitationAddress,
} from './actions';
import { MEAL_OPTIONS } from '@/lib/constants';
import { guests, events } from '@/lib/db/schema';
import { type DbClient } from '@/lib/db';

import { auth, getAuthIdentity } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getCloudflareContext } from '@opennextjs/cloudflare';

type Guest = InferSelectModel<typeof guests>;

/**
 * Creates a mock Drizzle database for testing.
 * Provides only the methods used in submitRsvp tests.
 *
 * @param findFirstFn - Mock function for query.guests.findFirst
 * @param updateFn - Optional mock function for db.update
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

/** Minimal guest fixture. */
function makeGuest(
  id: string,
  invitationId: string,
  overrides: Partial<Guest> = {},
): Guest {
  return {
    id,
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
    ...overrides,
  };
}

describe('submitRsvp', () => {
  const mockAuth = vi.mocked(auth);
  const mockGetAuthIdentity = vi.mocked(getAuthIdentity);
  const mockGetDb = vi.mocked(getDb);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should successfully submit RSVP with valid data', async () => {
    const guestId = 'guest-1';
    const invitationId = 'invitation-1';

    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'guest', invitationId });

    const whereFn = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    const updateFn = vi.fn().mockReturnValue({ set: setFn });
    const mockDb = createMockDb(
      vi.fn().mockResolvedValue(makeGuest(guestId, invitationId)),
      updateFn,
    );

    mockGetDb.mockReturnValue(mockDb as DbClient);

    const response = await submitRsvp({
      invitationId,
      guests: [
        {
          id: guestId,
          attending: true,
          mealChoice: MEAL_OPTIONS.SHORT_RIB,
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
    mockGetAuthIdentity.mockReturnValue(null);

    await expect(
      submitRsvp({
        invitationId: 'invitation-1',
        guests: [
          {
            id: 'guest-1',
            attending: true,
            mealChoice: MEAL_OPTIONS.ROASTED_CHICKEN,
            dietaryRestrictions: null,
            notes: null,
          },
        ],
      }),
    ).rejects.toThrow('Unauthorized');
  });

  test('should throw error when identity is null', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue(null);

    await expect(
      submitRsvp({
        invitationId: 'invitation-1',
        guests: [
          {
            id: 'guest-1',
            attending: true,
            mealChoice: MEAL_OPTIONS.ROASTED_CHICKEN,
            dietaryRestrictions: null,
            notes: null,
          },
        ],
      }),
    ).rejects.toThrow('Unauthorized');
  });

  test('should throw error when guest submits for a different invitation', async () => {
    mockAuth.mockResolvedValue(makeSession());
    // Guest's session identity is tied to invitation-2, not invitation-1
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'invitation-2',
    });

    await expect(
      submitRsvp({
        invitationId: 'invitation-1',
        guests: [
          {
            id: 'guest-1',
            attending: true,
            mealChoice: MEAL_OPTIONS.ROASTED_CHICKEN,
            dietaryRestrictions: null,
            notes: null,
          },
        ],
      }),
    ).rejects.toThrow('Not authorized for this invitation');
  });

  test('should throw error when attending without meal choice', async () => {
    const invitationId = 'invitation-1';

    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'guest', invitationId });

    const mockDb = createMockDb(
      vi.fn().mockResolvedValue(makeGuest('guest-1', invitationId)),
    );

    mockGetDb.mockReturnValue(mockDb as DbClient);

    await expect(
      submitRsvp({
        invitationId,
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

    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'guest', invitationId });

    const whereFn = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    const updateFn = vi.fn().mockReturnValue({ set: setFn });
    const mockDb = createMockDb(
      vi
        .fn()
        .mockResolvedValue(
          makeGuest(guestId, invitationId, { firstName: 'Guest' }),
        ),
      updateFn,
    );

    mockGetDb.mockReturnValue(mockDb as DbClient);

    const response = await submitRsvp({
      invitationId,
      guests: [
        {
          id: guestId,
          attending: true,
          mealChoice: MEAL_OPTIONS.SHORT_RIB,
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

    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'guest', invitationId });

    const whereFn = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    const updateFn = vi.fn().mockReturnValue({ set: setFn });

    // Guest belongs to a different invitation — should be skipped
    const mockDb = createMockDb(
      vi.fn().mockResolvedValue(makeGuest(guestId, 'other-invitation')),
      updateFn,
    );

    mockGetDb.mockReturnValue(mockDb as DbClient);

    const response = await submitRsvp({
      invitationId,
      guests: [
        {
          id: guestId,
          attending: true,
          mealChoice: MEAL_OPTIONS.SHORT_RIB,
          dietaryRestrictions: null,
          notes: null,
        },
      ],
    });

    expect(response).toEqual({ success: true });
    expect(updateFn).not.toHaveBeenCalled();
  });

  test('should allow not attending without meal choice', async () => {
    const guestId = 'guest-1';
    const invitationId = 'invitation-1';

    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'guest', invitationId });

    const whereFn = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    const updateFn = vi.fn().mockReturnValue({ set: setFn });
    const mockDb = createMockDb(
      vi.fn().mockResolvedValue(makeGuest(guestId, invitationId)),
      updateFn,
    );

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
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'invitation-1',
    });

    mockGetDb.mockReturnValue(
      createMockDb(vi.fn().mockResolvedValue(null)) as DbClient,
    );

    await expect(
      submitRsvp({
        invitationId: 'invitation-1',
        guests: [],
      }),
    ).rejects.toThrow('Invalid request data');
  });

  test('should throw error when invitation ID is missing', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'invitation-1',
    });

    await expect(
      submitRsvp({
        invitationId: '',
        guests: [
          {
            id: 'guest-1',
            attending: true,
            mealChoice: MEAL_OPTIONS.ROASTED_CHICKEN,
            dietaryRestrictions: null,
            notes: null,
          },
        ],
      }),
    ).rejects.toThrow('Invalid request data');
  });
});

// ---------------------------------------------------------------------------
// Email persistence tests
// ---------------------------------------------------------------------------

/**
 * Creates a full mock database for email persistence tests.
 * Supports queries for the guests table and db.update for email writes.
 *
 * @param guestFindFirstFn - Mock for guests.findFirst.
 * @param updateFn - Optional mock for db.update.
 * @returns Partial DbClient mock.
 */
function createEmailTestMockDb(
  guestFindFirstFn: ReturnType<typeof vi.fn>,
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
    },
    update: effectiveUpdateFn,
  } as unknown as Partial<DbClient>;
}

describe('submitRsvp — email persistence', () => {
  const mockAuth = vi.mocked(auth);
  const mockGetAuthIdentity = vi.mocked(getAuthIdentity);
  const mockGetDb = vi.mocked(getDb);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should update Invitation.contactEmail and User.email when contactEmail is provided', async () => {
    const guestId = 'guest-1';
    const invitationId = 'invitation-1';
    const userId = 'user-1';

    mockAuth.mockResolvedValue(makeSession({ id: userId }));
    mockGetAuthIdentity.mockReturnValue({ type: 'guest', invitationId });

    const whereFn = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    const updateFn = vi.fn().mockReturnValue({ set: setFn });
    const mockDb = createEmailTestMockDb(
      vi.fn().mockResolvedValue(makeGuest(guestId, invitationId, { userId })),
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

    // db.update called for: guest update + invitation email + user email
    expect(updateFn).toHaveBeenCalledTimes(3);
  });

  test('should not update email tables when contactEmail is absent', async () => {
    const guestId = 'guest-1';
    const invitationId = 'invitation-1';

    mockAuth.mockResolvedValue(makeSession({ id: 'user-1' }));
    mockGetAuthIdentity.mockReturnValue({ type: 'guest', invitationId });

    const whereFn = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    const updateFn = vi.fn().mockReturnValue({ set: setFn });
    const mockDb = createEmailTestMockDb(
      vi.fn().mockResolvedValue(makeGuest(guestId, invitationId)),
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

    mockAuth.mockResolvedValue(makeSession({ id: 'user-1' }));
    mockGetAuthIdentity.mockReturnValue({ type: 'guest', invitationId });

    const whereFn = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    const updateFn = vi.fn().mockReturnValue({ set: setFn });
    const mockDb = createEmailTestMockDb(
      vi.fn().mockResolvedValue(makeGuest(guestId, invitationId)),
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

  test('should not update user email when session has no user id', async () => {
    const guestId = 'guest-1';
    const invitationId = 'invitation-1';

    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'guest', invitationId });

    const whereFn = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    const updateFn = vi.fn().mockReturnValue({ set: setFn });
    const mockDb = createEmailTestMockDb(
      vi.fn().mockResolvedValue(makeGuest(guestId, invitationId)),
      updateFn,
    );

    mockGetDb.mockReturnValue(mockDb as DbClient);

    await submitRsvp({
      invitationId,
      contactEmail: 'test@example.com',
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

    // Guest update + invitation email, but NOT user email (no userId in session)
    expect(updateFn).toHaveBeenCalledTimes(2);
  });
});

describe('fetchGuestEvents', () => {
  type WeddingEvent = typeof events.$inferSelect;

  const mockAuth = vi.mocked(auth);
  const mockGetAuthIdentity = vi.mocked(getAuthIdentity);
  const mockGetDb = vi.mocked(getDb);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Creates a minimal WeddingEvent fixture.
   *
   * @param id - Event identifier.
   * @param rsvpRequired - Whether RSVP is required for this event.
   * @returns Minimal WeddingEvent object.
   */
  function makeEvent(id: string, rsvpRequired: boolean): WeddingEvent {
    return {
      id,
      name: `Event ${id}`,
      description: null,
      location: null,
      eventDate: '2026-09-12',
      startTime: '10:00',
      endTime: '11:00',
      type: 'other',
      dressCode: null,
      parkingInfo: null,
      locationLat: null,
      locationLng: null,
      sortOrder: 0,
      rsvpRequired,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Creates a mock DB for fetchGuestEvents tests.
   *
   * @param guestEventRows - Rows returned by guestEvents.findMany.
   * @param guestIds - Guest IDs to include on the invitation.
   * @returns Partial DbClient with all required methods mocked.
   */
  function createFetchGuestEventsMockDb(
    guestEventRows: Array<{ event: WeddingEvent }>,
    guestIds: string[],
  ): DbClient {
    const rsvpWhereFn = vi.fn().mockResolvedValue([]);
    const rsvpFromFn = vi.fn().mockReturnValue({ where: rsvpWhereFn });
    const rsvpSelectFn = vi.fn().mockReturnValue({ from: rsvpFromFn });

    return {
      query: {
        invitations: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'invite-1',
            guests: guestIds.map((id) => ({ id })),
          }),
        },
        guestEvents: {
          findMany: vi.fn().mockResolvedValue(guestEventRows),
        },
      },
      select: rsvpSelectFn,
    } as unknown as DbClient;
  }

  test('should return only events where rsvpRequired is true', async () => {
    const invitationId = 'invite-1';

    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'guest', invitationId });

    const rsvpRequiredEvent = makeEvent('event-rsvp', true);
    const optOutEvent = makeEvent('event-opt', false);

    const mockDb = createFetchGuestEventsMockDb(
      [{ event: rsvpRequiredEvent }, { event: optOutEvent }],
      ['guest-1'],
    );

    mockGetDb.mockReturnValue(mockDb);

    const result = await fetchGuestEvents();

    expect(result).toHaveLength(1);
    expect(result[0].event.id).toBe('event-rsvp');
  });

  test('should exclude events where rsvpRequired is false', async () => {
    const invitationId = 'invite-1';

    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'guest', invitationId });

    const optOutEvent = makeEvent('event-opt', false);

    const mockDb = createFetchGuestEventsMockDb(
      [{ event: optOutEvent }],
      ['guest-1'],
    );

    mockGetDb.mockReturnValue(mockDb);

    const result = await fetchGuestEvents();

    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// updateInvitationAddress tests
// ---------------------------------------------------------------------------

/**
 * Creates a mock DB for updateInvitationAddress tests.
 * Supports db.update().set().where() calls for both invitations and users tables.
 *
 * @param updateFn - Optional custom mock for db.update.
 * @returns Partial DbClient with mocked update chain.
 */
function createAddressMockDb(
  updateFn?: ReturnType<typeof vi.fn>,
): Partial<DbClient> {
  const whereFn = vi.fn().mockResolvedValue(undefined);
  const setFn = vi.fn().mockReturnValue({ where: whereFn });
  const effectiveUpdateFn = updateFn ?? vi.fn().mockReturnValue({ set: setFn });

  return { update: effectiveUpdateFn } as unknown as Partial<DbClient>;
}

/** Minimal address payload shared across tests. */
const BASE_ADDRESS_INPUT = {
  invitationId: 'invitation-1',
  mailingAddress: 'The Smith Family',
  address: '123 Main St',
  addressLine2: null,
  city: 'Boston',
  state: 'MA',
  zipCode: '02101',
} as const;

describe('updateInvitationAddress', () => {
  const mockAuth = vi.mocked(auth);
  const mockGetAuthIdentity = vi.mocked(getAuthIdentity);
  const mockGetDb = vi.mocked(getDb);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should throw when user is not authenticated', async () => {
    mockAuth.mockResolvedValue(null);
    mockGetAuthIdentity.mockReturnValue(null);

    await expect(updateInvitationAddress(BASE_ADDRESS_INPUT)).rejects.toThrow(
      'Unauthorized',
    );
  });

  test('should throw when identity is null', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue(null);

    await expect(updateInvitationAddress(BASE_ADDRESS_INPUT)).rejects.toThrow(
      'Unauthorized',
    );
  });

  test('should throw when a guest attempts to update a different invitation', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'invitation-2',
    });

    await expect(updateInvitationAddress(BASE_ADDRESS_INPUT)).rejects.toThrow(
      'Not authorized for this invitation',
    );
  });

  test('should throw when invitationId is empty', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'invitation-1',
    });

    await expect(
      updateInvitationAddress({ ...BASE_ADDRESS_INPUT, invitationId: '' }),
    ).rejects.toThrow('Invalid request data');
  });

  test('should throw when an address field exceeds the maximum length', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'invitation-1',
    });

    await expect(
      updateInvitationAddress({
        ...BASE_ADDRESS_INPUT,
        address: 'A'.repeat(201),
      }),
    ).rejects.toThrow('Invalid request data');
  });

  test('should throw when contactEmail is not a valid email address', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'invitation-1',
    });

    await expect(
      updateInvitationAddress({
        ...BASE_ADDRESS_INPUT,
        contactEmail: 'not-an-email',
      }),
    ).rejects.toThrow('Invalid request data');
  });

  test('should successfully update address fields and return success', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'invitation-1',
    });

    const mockDb = createAddressMockDb();
    mockGetDb.mockReturnValue(mockDb as DbClient);

    const result = await updateInvitationAddress(BASE_ADDRESS_INPUT);

    expect(result).toEqual({ success: true });
    // One db.update call — the invitation address update
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  test('should allow admin to update any invitation', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });

    const mockDb = createAddressMockDb();
    mockGetDb.mockReturnValue(mockDb as DbClient);

    const result = await updateInvitationAddress(BASE_ADDRESS_INPUT);

    expect(result).toEqual({ success: true });
  });

  test('should persist contactEmail to invitation and user when provided', async () => {
    const userId = 'user-1';

    mockAuth.mockResolvedValue(makeSession({ id: userId }));
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'invitation-1',
    });

    const whereFn = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    const updateFn = vi.fn().mockReturnValue({ set: setFn });
    const mockDb = createAddressMockDb(updateFn);
    mockGetDb.mockReturnValue(mockDb as DbClient);

    await updateInvitationAddress({
      ...BASE_ADDRESS_INPUT,
      contactEmail: 'jane@example.com',
    });

    // Two db.update calls: invitation address + user email
    expect(updateFn).toHaveBeenCalledTimes(2);
  });

  test('should not update user email when contactEmail is absent', async () => {
    mockAuth.mockResolvedValue(makeSession({ id: 'user-1' }));
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'invitation-1',
    });

    const whereFn = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    const updateFn = vi.fn().mockReturnValue({ set: setFn });
    const mockDb = createAddressMockDb(updateFn);
    mockGetDb.mockReturnValue(mockDb as DbClient);

    await updateInvitationAddress(BASE_ADDRESS_INPUT);

    // Only the invitation update — no email updates
    expect(updateFn).toHaveBeenCalledTimes(1);
  });

  test('should not update user email when contactEmail is an empty string', async () => {
    mockAuth.mockResolvedValue(makeSession({ id: 'user-1' }));
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'invitation-1',
    });

    const whereFn = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    const updateFn = vi.fn().mockReturnValue({ set: setFn });
    const mockDb = createAddressMockDb(updateFn);
    mockGetDb.mockReturnValue(mockDb as DbClient);

    await updateInvitationAddress({ ...BASE_ADDRESS_INPUT, contactEmail: '' });

    // Only the invitation update — empty string treated the same as absent
    expect(updateFn).toHaveBeenCalledTimes(1);
  });

  test('should not update user email when session has no user id', async () => {
    // makeSession() produces a session without a userId — simulates
    // an authenticated session where the user record has no id set
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'invitation-1',
    });

    const whereFn = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    const updateFn = vi.fn().mockReturnValue({ set: setFn });
    const mockDb = createAddressMockDb(updateFn);
    mockGetDb.mockReturnValue(mockDb as DbClient);

    await updateInvitationAddress({
      ...BASE_ADDRESS_INPUT,
      contactEmail: 'test@example.com',
    });

    // Invitation update only — user update skipped because userId is undefined
    expect(updateFn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Notification queue tests
// ---------------------------------------------------------------------------

describe('submitRsvp — notification queue', () => {
  const mockAuth = vi.mocked(auth);
  const mockGetAuthIdentity = vi.mocked(getAuthIdentity);
  const mockGetDb = vi.mocked(getDb);
  const mockGetCloudflareContext = vi.mocked(getCloudflareContext);

  const invitationId = 'invitation-1';
  const guestId = 'guest-1';

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'guest', invitationId });

    const whereFn = vi.fn().mockResolvedValue(undefined);
    const setFn = vi.fn().mockReturnValue({ where: whereFn });
    const updateFn = vi.fn().mockReturnValue({ set: setFn });

    mockGetDb.mockReturnValue(
      createMockDb(
        vi.fn().mockResolvedValue(makeGuest(guestId, invitationId)),
        updateFn,
      ) as DbClient,
    );
  });

  test('should enqueue a notification after a first-time submission', async () => {
    const mockQueueSend = vi.fn().mockResolvedValue(undefined);

    mockGetCloudflareContext.mockReturnValue({
      env: { RSVP_NOTIFICATION_QUEUE: { send: mockQueueSend } },
    } as never);

    await submitRsvp({
      invitationId,
      guests: [
        {
          id: guestId,
          attending: true,
          mealChoice: MEAL_OPTIONS.SHORT_RIB,
          dietaryRestrictions: null,
          notes: null,
        },
      ],
    });

    expect(mockQueueSend).toHaveBeenCalledOnce();

    const [payload, options] = mockQueueSend.mock.calls[0];

    expect(payload).toMatchObject({
      isUpdate: false,
      guestName: 'John Doe',
      eventName: 'Wedding Celebration',
      attendanceStatus: 'attending',
      numberOfAttending: 1,
    });
    expect(options).toEqual({ contentType: 'json' });
  });

  test('should set isUpdate: true when the guest already had a response', async () => {
    const mockQueueSend = vi.fn().mockResolvedValue(undefined);

    mockGetCloudflareContext.mockReturnValue({
      env: { RSVP_NOTIFICATION_QUEUE: { send: mockQueueSend } },
    } as never);

    // Guest already has attending = true → this is an update
    mockGetDb.mockReturnValue(
      createMockDb(
        vi
          .fn()
          .mockResolvedValue(
            makeGuest(guestId, invitationId, { attending: true }),
          ),
        vi.fn().mockReturnValue({
          set: vi
            .fn()
            .mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        }),
      ) as DbClient,
    );

    await submitRsvp({
      invitationId,
      guests: [
        {
          id: guestId,
          attending: true,
          mealChoice: MEAL_OPTIONS.SHORT_RIB,
          dietaryRestrictions: null,
          notes: null,
        },
      ],
    });

    const [payload] = mockQueueSend.mock.calls[0];

    expect(payload).toMatchObject({ isUpdate: true });
  });

  test('should not throw when the notification queue send fails', async () => {
    mockGetCloudflareContext.mockReturnValue({
      env: {
        RSVP_NOTIFICATION_QUEUE: {
          send: vi.fn().mockRejectedValue(new Error('Queue unavailable')),
        },
      },
    } as never);

    const result = await submitRsvp({
      invitationId,
      guests: [
        {
          id: guestId,
          attending: true,
          mealChoice: MEAL_OPTIONS.SHORT_RIB,
          dietaryRestrictions: null,
          notes: null,
        },
      ],
    });

    // RSVP save succeeded despite notification failure
    expect(result).toEqual({ success: true });
  });

  test('should send attendanceStatus not_attending when all guests decline', async () => {
    const mockQueueSend = vi.fn().mockResolvedValue(undefined);

    mockGetCloudflareContext.mockReturnValue({
      env: { RSVP_NOTIFICATION_QUEUE: { send: mockQueueSend } },
    } as never);

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

    const [payload] = mockQueueSend.mock.calls[0];

    expect(payload).toMatchObject({
      attendanceStatus: 'not_attending',
      numberOfAttending: 0,
      attendees: [],
    });
  });

  test('should exclude guests from a different invitation from the notification payload', async () => {
    const mockQueueSend = vi.fn().mockResolvedValue(undefined);

    mockGetCloudflareContext.mockReturnValue({
      env: { RSVP_NOTIFICATION_QUEUE: { send: mockQueueSend } },
    } as never);

    const foreignGuestId = 'guest-foreign';

    // findGuestById returns a matching guest for guestId but null for the foreign guest,
    // simulating a guest that belongs to a different invitation.
    mockGetDb.mockReturnValue(
      createMockDb(
        vi
          .fn()
          .mockImplementation((query: { where: unknown }) => {
            // The repository calls findFirst with a where clause; we inspect the
            // serialised query args via the mock call sequence instead.
            void query;

            return Promise.resolve(null);
          })
          .mockResolvedValueOnce(makeGuest(guestId, invitationId))
          .mockResolvedValueOnce(null),
        vi.fn().mockReturnValue({
          set: vi
            .fn()
            .mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        }),
      ) as DbClient,
    );

    await submitRsvp({
      invitationId,
      guests: [
        {
          id: guestId,
          attending: true,
          mealChoice: MEAL_OPTIONS.SHORT_RIB,
          dietaryRestrictions: null,
          notes: null,
        },
        {
          id: foreignGuestId,
          attending: true,
          mealChoice: MEAL_OPTIONS.SHORT_RIB,
          dietaryRestrictions: null,
          notes: null,
        },
      ],
    });

    expect(mockQueueSend).toHaveBeenCalledOnce();

    const [payload] = mockQueueSend.mock.calls[0];

    // Only the verified guest should contribute to the payload.
    expect(payload).toMatchObject({
      isUpdate: false,
      numberOfAttending: 1,
      attendanceStatus: 'attending',
      attendees: [expect.objectContaining({ name: 'John Doe' })],
    });
  });
});
