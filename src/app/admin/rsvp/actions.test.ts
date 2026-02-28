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

import { expect, test, describe, beforeEach, vi } from 'vitest';
import { auth, getAuthIdentity } from '@/lib/auth';
import { getDb } from '@/lib/db';
import type { DbClient } from '@/lib/db';
import { makeSession } from '@/tests/helpers';
import {
  updateRsvpAttendance,
  cascadeRsvpNotAttending,
  updateAttendeeDetails,
} from './actions';

const mockAuth = vi.mocked(auth);
const mockGetAuthIdentity = vi.mocked(getAuthIdentity);
const mockGetDb = vi.mocked(getDb);

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

/**
 * Creates a mock Drizzle database for testing admin RSVP actions.
 *
 * @param overrides - Methods to override on the mock database.
 * @returns Partial DbClient with mocked methods.
 */
function createMockDb(
  overrides: Partial<{
    guestFindFirst: ReturnType<typeof vi.fn>;
    eventFindFirst: ReturnType<typeof vi.fn>;
    guestEventFindFirst: ReturnType<typeof vi.fn>;
    rsvpFindFirst: ReturnType<typeof vi.fn>;
    attendeeDelete: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  }> = {},
): DbClient {
  const whereFn = vi.fn().mockResolvedValue(undefined);
  const setFn = vi.fn().mockReturnValue({ where: whereFn });
  const updateFn = overrides.update ?? vi.fn().mockReturnValue({ set: setFn });

  const insertValuesFn = vi.fn().mockResolvedValue(undefined);
  const insertFn =
    overrides.insert ?? vi.fn().mockReturnValue({ values: insertValuesFn });

  return {
    query: {
      guests: {
        findFirst: overrides.guestFindFirst ?? vi.fn().mockResolvedValue(null),
      },
      events: {
        findFirst: overrides.eventFindFirst ?? vi.fn().mockResolvedValue(null),
      },
      guestEvents: {
        findFirst:
          overrides.guestEventFindFirst ?? vi.fn().mockResolvedValue(null),
      },
      rsvpResponses: {
        findFirst: overrides.rsvpFindFirst ?? vi.fn().mockResolvedValue(null),
      },
    },
    insert: insertFn,
    update: updateFn,
    delete:
      overrides.attendeeDelete ??
      vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
  } as unknown as DbClient;
}

// ---------------------------------------------------------------------------
// updateRsvpAttendance
// ---------------------------------------------------------------------------

describe('updateRsvpAttendance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should throw Unauthorized when session is null', async () => {
    mockAuth.mockResolvedValue(null);
    mockGetAuthIdentity.mockReturnValue(null);

    await expect(
      updateRsvpAttendance({
        guestId: 'g1',
        eventId: 'e1',
        attendanceStatus: 'attending',
      }),
    ).rejects.toThrow('Unauthorized');
  });

  test('should throw Unauthorized when session roles array does not include "admin"', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue(null);

    await expect(
      updateRsvpAttendance({
        guestId: 'g1',
        eventId: 'e1',
        attendanceStatus: 'attending',
      }),
    ).rejects.toThrow('Unauthorized');
  });

  test('should create a new RsvpResponse row when none exists for the guestId/eventId pair', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });

    const mockDb = createMockDb({
      guestFindFirst: vi.fn().mockResolvedValue({ id: 'g1' }),
      eventFindFirst: vi.fn().mockResolvedValue({ id: 'e1' }),
      guestEventFindFirst: vi.fn().mockResolvedValue({ id: 'ge1' }),
      rsvpFindFirst: vi.fn().mockResolvedValue(null),
    });

    mockGetDb.mockReturnValue(mockDb);

    const result = await updateRsvpAttendance({
      guestId: 'g1',
      eventId: 'e1',
      attendanceStatus: 'attending',
    });

    expect(result).toEqual({ success: true });
    expect(mockDb.insert).toHaveBeenCalled();
  });

  test('should update attendanceStatus on an existing RsvpResponse', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });

    const mockDb = createMockDb({
      guestFindFirst: vi.fn().mockResolvedValue({ id: 'g1' }),
      eventFindFirst: vi.fn().mockResolvedValue({ id: 'e1' }),
      guestEventFindFirst: vi.fn().mockResolvedValue({ id: 'ge1' }),
      rsvpFindFirst: vi.fn().mockResolvedValue({
        id: 'rsvp1',
        guestId: 'g1',
        eventId: 'e1',
        attendanceStatus: 'not_attending',
      }),
    });

    mockGetDb.mockReturnValue(mockDb);

    const result = await updateRsvpAttendance({
      guestId: 'g1',
      eventId: 'e1',
      attendanceStatus: 'attending',
    });

    expect(result).toEqual({ success: true });
    expect(mockDb.update).toHaveBeenCalled();
  });

  test('should return { success: false } when the guest does not exist', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });

    const mockDb = createMockDb({
      guestFindFirst: vi.fn().mockResolvedValue(null),
    });

    mockGetDb.mockReturnValue(mockDb);

    const result = await updateRsvpAttendance({
      guestId: 'g-missing',
      eventId: 'e1',
      attendanceStatus: 'attending',
    });

    expect(result).toEqual({ success: false, error: expect.any(String) });
  });

  test('should return { success: false } when the guest is not invited to the event (no GuestEvent row)', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });

    const mockDb = createMockDb({
      guestFindFirst: vi.fn().mockResolvedValue({ id: 'g1' }),
      eventFindFirst: vi.fn().mockResolvedValue({ id: 'e1' }),
      guestEventFindFirst: vi.fn().mockResolvedValue(null),
    });

    mockGetDb.mockReturnValue(mockDb);

    const result = await updateRsvpAttendance({
      guestId: 'g1',
      eventId: 'e1',
      attendanceStatus: 'attending',
    });

    expect(result).toEqual({ success: false, error: expect.any(String) });
  });
});

// ---------------------------------------------------------------------------
// cascadeRsvpNotAttending
// ---------------------------------------------------------------------------

describe('cascadeRsvpNotAttending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should throw Unauthorized when session lacks admin role', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue(null);

    await expect(
      cascadeRsvpNotAttending({ guestId: 'g1', cascadeToEvents: false }),
    ).rejects.toThrow('Unauthorized');
  });

  test('should update only the main wedding RsvpResponse when cascadeToEvents is false', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });

    const updateWhereFn = vi.fn().mockResolvedValue(undefined);
    const updateSetFn = vi.fn().mockReturnValue({ where: updateWhereFn });
    const updateFn = vi.fn().mockReturnValue({ set: updateSetFn });

    const mockDb = createMockDb({
      guestFindFirst: vi.fn().mockResolvedValue({ id: 'g1' }),
      eventFindFirst: vi.fn().mockResolvedValue({ id: 'e-main', type: 'main' }),
      update: updateFn,
    });

    mockGetDb.mockReturnValue(mockDb);

    const result = await cascadeRsvpNotAttending({
      guestId: 'g1',
      cascadeToEvents: false,
    });

    expect(result).toEqual({ success: true });
    // Should update exactly once (just the wedding response)
    expect(updateFn).toHaveBeenCalledTimes(1);
  });

  test('should update the wedding RsvpResponse and all per-event RsvpResponses when cascadeToEvents is true', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });

    const updateWhereFn = vi.fn().mockResolvedValue(undefined);
    const updateSetFn = vi.fn().mockReturnValue({ where: updateWhereFn });
    const updateFn = vi.fn().mockReturnValue({ set: updateSetFn });

    const mockDb = createMockDb({
      guestFindFirst: vi.fn().mockResolvedValue({ id: 'g1' }),
      update: updateFn,
    });

    mockGetDb.mockReturnValue(mockDb);

    const result = await cascadeRsvpNotAttending({
      guestId: 'g1',
      cascadeToEvents: true,
    });

    expect(result).toEqual({ success: true });
    // Should update all rsvpResponses for this guest (≥ 1 call)
    expect(updateFn).toHaveBeenCalled();
  });

  test('should update all rsvpResponses directly when cascadeToEvents is true', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });

    const updateWhereFn = vi.fn().mockResolvedValue(undefined);
    const updateSetFn = vi.fn().mockReturnValue({ where: updateWhereFn });
    const updateFn = vi.fn().mockReturnValue({ set: updateSetFn });

    const mockDb = createMockDb({
      guestFindFirst: vi.fn().mockResolvedValue({ id: 'g1' }),
      update: updateFn,
    });

    mockGetDb.mockReturnValue(mockDb);

    await cascadeRsvpNotAttending({ guestId: 'g1', cascadeToEvents: true });

    expect(updateFn).toHaveBeenCalledTimes(1);
    expect(updateSetFn).toHaveBeenCalledWith(
      expect.objectContaining({ attendanceStatus: 'not_attending' }),
    );
  });

  test('should return { success: false } when the guest does not exist', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });

    const mockDb = createMockDb({
      guestFindFirst: vi.fn().mockResolvedValue(null),
    });

    mockGetDb.mockReturnValue(mockDb);

    const result = await cascadeRsvpNotAttending({
      guestId: 'g-missing',
      cascadeToEvents: false,
    });

    expect(result).toEqual({ success: false, error: expect.any(String) });
  });
});

// ---------------------------------------------------------------------------
// updateAttendeeDetails
// ---------------------------------------------------------------------------

describe('updateAttendeeDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should throw Unauthorized when session lacks admin role', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue(null);

    await expect(
      updateAttendeeDetails({ rsvpResponseId: 'rsvp1', attendees: [] }),
    ).rejects.toThrow('Unauthorized');
  });

  test('should delete all existing Attendee rows for the rsvpResponseId before reinserting', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });

    const deleteFn = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const mockDb = createMockDb({
      rsvpFindFirst: vi.fn().mockResolvedValue({ id: 'rsvp1' }),
      attendeeDelete: deleteFn,
    });

    mockGetDb.mockReturnValue(mockDb);

    await updateAttendeeDetails({
      rsvpResponseId: 'rsvp1',
      attendees: [],
    });

    expect(deleteFn).toHaveBeenCalled();
  });

  test('should insert the provided attendees list with correct field values', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });

    const insertValuesFn = vi.fn().mockResolvedValue(undefined);
    const insertFn = vi.fn().mockReturnValue({ values: insertValuesFn });

    const mockDb = createMockDb({
      rsvpFindFirst: vi.fn().mockResolvedValue({ id: 'rsvp1' }),
      insert: insertFn,
    });

    mockGetDb.mockReturnValue(mockDb);

    const newAttendees = [
      {
        name: 'Alice',
        mealOption: 'option_a' as const,
        dietaryRestrictions: 'Vegan',
      },
    ];

    await updateAttendeeDetails({
      rsvpResponseId: 'rsvp1',
      attendees: newAttendees,
    });

    expect(insertValuesFn).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Alice',
          mealOption: 'option_a',
          dietaryRestrictions: 'Vegan',
          rsvpResponseId: 'rsvp1',
        }),
      ]),
    );
  });

  test('should update rsvpResponse.updatedAt on success', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });

    const updateWhereFn = vi.fn().mockResolvedValue(undefined);
    const updateSetFn = vi.fn().mockReturnValue({ where: updateWhereFn });
    const updateFn = vi.fn().mockReturnValue({ set: updateSetFn });

    const mockDb = createMockDb({
      rsvpFindFirst: vi.fn().mockResolvedValue({ id: 'rsvp1' }),
      update: updateFn,
    });

    mockGetDb.mockReturnValue(mockDb);

    await updateAttendeeDetails({ rsvpResponseId: 'rsvp1', attendees: [] });

    expect(updateFn).toHaveBeenCalled();
    expect(updateSetFn).toHaveBeenCalledWith(
      expect.objectContaining({ updatedAt: expect.any(String) }),
    );
  });

  test('should return { success: false } when rsvpResponseId does not exist', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });

    const mockDb = createMockDb({
      rsvpFindFirst: vi.fn().mockResolvedValue(null),
    });

    mockGetDb.mockReturnValue(mockDb);

    const result = await updateAttendeeDetails({
      rsvpResponseId: 'rsvp-missing',
      attendees: [],
    });

    expect(result).toEqual({ success: false, error: expect.any(String) });
  });
});
