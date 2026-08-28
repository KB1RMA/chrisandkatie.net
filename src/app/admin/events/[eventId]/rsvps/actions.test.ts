/**
 * @vitest-environment node
 */

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  getAuthIdentity: vi.fn(),
}));

vi.mock('@/lib/db/repositories/events', () => ({
  findEventById: vi.fn(),
}));

vi.mock('@/lib/db/repositories/guests', () => ({
  findGuestById: vi.fn(),
}));

vi.mock('@/lib/db/repositories/guestEvents', () => ({
  findGuestEventsForEvent: vi.fn(),
}));

vi.mock('@/lib/db/repositories/rsvpResponses', () => ({
  findEventResponsesForGuestIds: vi.fn(),
  replacePartyEventRsvp: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { expect, test, describe, beforeEach, vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { auth, getAuthIdentity } from '@/lib/auth';
import * as EventRepository from '@/lib/db/repositories/events';
import * as GuestRepository from '@/lib/db/repositories/guests';
import * as GuestEventRepository from '@/lib/db/repositories/guestEvents';
import * as RsvpRepository from '@/lib/db/repositories/rsvpResponses';
import type { WeddingEvent } from '@/lib/db/schema';
import { makeSession } from '@/tests/helpers';
import { setPartyEventRsvp } from './actions';

const mockAuth = vi.mocked(auth);
const mockGetAuthIdentity = vi.mocked(getAuthIdentity);
const mockFindEventById = vi.mocked(EventRepository.findEventById);
const mockFindGuest = vi.mocked(GuestRepository.findGuestById);
const mockFindGuestEvents = vi.mocked(
  GuestEventRepository.findGuestEventsForEvent,
);
const mockFindResponses = vi.mocked(
  RsvpRepository.findEventResponsesForGuestIds,
);
const mockReplaceParty = vi.mocked(RsvpRepository.replacePartyEventRsvp);
const mockRevalidatePath = vi.mocked(revalidatePath);

const EVENT_ID = 'event-1';

/** Marks the mocked session as an authenticated admin. */
function mockAdminSession(): void {
  mockAuth.mockResolvedValue(makeSession());
  mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });
}

/** Builds the event row fixture the RSVP page is scoped to. */
function makeEvent(): WeddingEvent {
  return {
    id: EVENT_ID,
    name: 'Rehearsal Dinner',
    description: null,
    location: null,
    eventDate: '2026-09-11',
    startTime: '18:00',
    endTime: '22:00',
    type: 'other',
    dressCode: null,
    parkingInfo: null,
    locationLat: null,
    locationLng: null,
    sortOrder: 0,
    rsvpRequired: true,
    createdAt: '2026-07-06T00:00:00.000Z',
    updatedAt: '2026-07-06T00:00:00.000Z',
  };
}

/** Builds the clicked guest fixture. */
function makeGuest() {
  return {
    id: 'guest-1',
    firstName: 'Jane',
    lastName: 'Doe',
    invitationId: 'inv-1',
  } as unknown as Awaited<ReturnType<typeof GuestRepository.findGuestById>>;
}

const PARTY = [
  { id: 'guest-1', firstName: 'Jane', lastName: 'Doe', invitationId: 'inv-1' },
  { id: 'guest-2', firstName: 'John', lastName: 'Doe', invitationId: 'inv-1' },
];

/**
 * Builds the event's GuestEvent rows, optionally narrowed to some party
 * members and always including a guest from another party.
 */
function makeGuestEvents(guestIds: string[] = ['guest-1', 'guest-2']) {
  const rows = PARTY.filter((member) => guestIds.includes(member.id)).map(
    (guest) => ({
      id: `ge-${guest.id}`,
      guestId: guest.id,
      eventId: EVENT_ID,
      guest,
    }),
  );

  return [
    ...rows,
    {
      id: 'ge-other',
      guestId: 'guest-other',
      eventId: EVENT_ID,
      guest: {
        id: 'guest-other',
        firstName: 'Sam',
        lastName: 'Roe',
        invitationId: 'inv-2',
      },
    },
  ] as unknown as Awaited<
    ReturnType<typeof GuestEventRepository.findGuestEventsForEvent>
  >;
}

/** Builds a stored party response with the given attendee rows. */
function makeResponse(overrides: {
  id?: string;
  guestId?: string;
  attendanceStatus?: 'attending' | 'not_attending';
  attendees?: Array<{
    id: string;
    name: string;
    mealOption?: 'option_a' | 'option_b' | null;
    dietaryRestrictions?: string | null;
  }>;
}) {
  return {
    id: overrides.id ?? 'rsvp-1',
    guestId: overrides.guestId ?? 'guest-1',
    eventId: EVENT_ID,
    attendanceStatus: overrides.attendanceStatus ?? 'attending',
    numberOfAttending: overrides.attendees?.length ?? 0,
    specialRequests: null,
    submittedAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    attendees: (overrides.attendees ?? []).map((attendee) => ({
      mealOption: null,
      dietaryRestrictions: null,
      ...attendee,
    })),
  };
}

/** The `updatedAt` every `makeResponse` fixture carries. */
const SEEDED_UPDATED_AT = '2026-07-01T00:00:00.000Z';

const VALID_INPUT = {
  eventId: EVENT_ID,
  guestId: 'guest-1',
  // The seeded default is a party with no stored response.
  expectedUpdatedAt: null,
  statuses: [
    { guestId: 'guest-1', attending: true },
    { guestId: 'guest-2', attending: false },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFindEventById.mockResolvedValue(makeEvent());
  mockFindGuest.mockResolvedValue(makeGuest());
  mockFindGuestEvents.mockResolvedValue(makeGuestEvents());
  mockFindResponses.mockResolvedValue(
    [] as unknown as Awaited<
      ReturnType<typeof RsvpRepository.findEventResponsesForGuestIds>
    >,
  );
});

describe('setPartyEventRsvp', () => {
  test('should reject an unauthenticated caller', async () => {
    mockAuth.mockResolvedValue(null);
    mockGetAuthIdentity.mockReturnValue(null);

    await expect(setPartyEventRsvp(VALID_INPUT)).rejects.toThrow(
      'Unauthorized',
    );
    expect(mockReplaceParty).not.toHaveBeenCalled();
  });

  test('should reject a guest identity', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'inv-1',
    });

    await expect(setPartyEventRsvp(VALID_INPUT)).rejects.toThrow(
      'Unauthorized',
    );
    expect(mockReplaceParty).not.toHaveBeenCalled();
  });

  test('should reject invalid input', async () => {
    mockAdminSession();

    const result = await setPartyEventRsvp({ ...VALID_INPUT, statuses: [] });

    expect(result).toEqual({
      success: false,
      error: 'At least one party member is required',
    });
    expect(mockReplaceParty).not.toHaveBeenCalled();
  });

  test('should fail when the event does not exist', async () => {
    mockAdminSession();
    mockFindEventById.mockResolvedValue(undefined);

    const result = await setPartyEventRsvp(VALID_INPUT);

    expect(result).toEqual({ success: false, error: 'Event not found.' });
    expect(mockReplaceParty).not.toHaveBeenCalled();
  });

  test('should fail when the guest does not exist', async () => {
    mockAdminSession();
    mockFindGuest.mockResolvedValue(undefined);

    const result = await setPartyEventRsvp(VALID_INPUT);

    expect(result).toEqual({ success: false, error: 'Guest not found.' });
    expect(mockReplaceParty).not.toHaveBeenCalled();
  });

  test('should reject an edit for the main event', async () => {
    // The main event's guest-facing wizard writes only the legacy
    // Guest.attending column and never looks at RsvpResponse — an override
    // written here would be invisible to guests, so it must be refused
    // before it reaches the guest/membership lookups or the write.
    mockAdminSession();
    mockFindEventById.mockResolvedValue({ ...makeEvent(), type: 'main' });

    const result = await setPartyEventRsvp(VALID_INPUT);

    expect(result).toEqual({
      success: false,
      error:
        'Main event attendance is managed through the RSVP wizard and cannot be edited here.',
    });
    expect(mockFindGuest).not.toHaveBeenCalled();
    expect(mockFindGuestEvents).not.toHaveBeenCalled();
    expect(mockReplaceParty).not.toHaveBeenCalled();
  });

  test('should fail when the guest is not invited to the event', async () => {
    mockAdminSession();
    mockFindGuestEvents.mockResolvedValue(makeGuestEvents(['guest-2']));

    const result = await setPartyEventRsvp(VALID_INPUT);

    expect(result).toEqual({
      success: false,
      error: 'Guest is not invited to this event.',
    });
    expect(mockReplaceParty).not.toHaveBeenCalled();
  });

  test('should reject statuses naming a guest outside the party', async () => {
    mockAdminSession();

    const result = await setPartyEventRsvp({
      ...VALID_INPUT,
      statuses: [
        { guestId: 'guest-1', attending: true },
        { guestId: 'guest-2', attending: false },
        { guestId: 'outsider', attending: true },
      ],
    });

    expect(result).toEqual({
      success: false,
      error: 'The submitted guest list does not match this party.',
    });
    expect(mockReplaceParty).not.toHaveBeenCalled();
  });

  test('should reject statuses that omit a party member', async () => {
    mockAdminSession();

    const result = await setPartyEventRsvp({
      ...VALID_INPUT,
      statuses: [{ guestId: 'guest-1', attending: true }],
    });

    expect(result).toEqual({
      success: false,
      error: 'The submitted guest list does not match this party.',
    });
    expect(mockReplaceParty).not.toHaveBeenCalled();
  });

  test('should reject a save carrying a stale party timestamp', async () => {
    mockAdminSession();
    mockFindResponses.mockResolvedValue([
      makeResponse({ attendees: [{ id: 'att-1', name: 'Jane Doe' }] }),
    ] as unknown as Awaited<
      ReturnType<typeof RsvpRepository.findEventResponsesForGuestIds>
    >);

    const result = await setPartyEventRsvp({
      ...VALID_INPUT,
      expectedUpdatedAt: '2026-06-01T00:00:00.000Z',
    });

    expect(result).toEqual({
      success: false,
      error:
        "This party's RSVP changed since this page was loaded. Refresh and try again.",
    });
    expect(mockReplaceParty).not.toHaveBeenCalled();
  });

  test('should reject a save claiming no response when the party now has one', async () => {
    mockAdminSession();
    mockFindResponses.mockResolvedValue([
      makeResponse({ attendees: [] }),
    ] as unknown as Awaited<
      ReturnType<typeof RsvpRepository.findEventResponsesForGuestIds>
    >);

    const result = await setPartyEventRsvp({
      ...VALID_INPUT,
      expectedUpdatedAt: null,
    });

    expect(result.success).toBe(false);
    expect(mockReplaceParty).not.toHaveBeenCalled();
  });

  test('should compare against the latest timestamp across the party rows', async () => {
    mockAdminSession();
    mockFindResponses.mockResolvedValue([
      {
        ...makeResponse({ id: 'rsvp-1' }),
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
      {
        ...makeResponse({ id: 'rsvp-2', guestId: 'guest-2' }),
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ] as unknown as Awaited<
      ReturnType<typeof RsvpRepository.findEventResponsesForGuestIds>
    >);

    const stale = await setPartyEventRsvp({
      ...VALID_INPUT,
      expectedUpdatedAt: '2026-07-01T00:00:00.000Z',
    });

    expect(stale.success).toBe(false);

    const fresh = await setPartyEventRsvp({
      ...VALID_INPUT,
      expectedUpdatedAt: '2026-08-01T00:00:00.000Z',
    });

    expect(fresh).toEqual({ success: true });
  });

  test('should create the party response when none exists yet', async () => {
    mockAdminSession();

    const result = await setPartyEventRsvp(VALID_INPUT);

    expect(result).toEqual({ success: true });

    const written = mockReplaceParty.mock.calls[0][0];

    expect(written.response).toMatchObject({
      guestId: 'guest-1',
      eventId: EVENT_ID,
      attendanceStatus: 'attending',
      numberOfAttending: 1,
    });
    expect(written.attendeeRows.map((row) => row.name)).toEqual(['Jane Doe']);
    expect(written.attendeeRows[0].rsvpResponseId).toBe(written.response.id);
    expect(written.staleAttendeeIds).toEqual([]);
  });

  test('should own a new response with the same member the guest RSVP page picks', async () => {
    // The guest form resolves a party to the first of its members listed for
    // the event; owning a new row with anyone else would let a later guest
    // submission land on a second, parallel row for the same party.
    mockAdminSession();
    mockFindGuest.mockResolvedValue({
      id: 'guest-2',
      firstName: 'John',
      lastName: 'Doe',
      invitationId: 'inv-1',
    } as unknown as Awaited<ReturnType<typeof GuestRepository.findGuestById>>);

    await setPartyEventRsvp({
      ...VALID_INPUT,
      guestId: 'guest-2',
    });

    expect(mockReplaceParty.mock.calls[0][0].response.guestId).toBe('guest-1');
  });

  test('should write to the existing party response rather than a new row', async () => {
    mockAdminSession();
    mockFindResponses.mockResolvedValue([
      makeResponse({
        id: 'rsvp-existing',
        guestId: 'guest-2',
        attendees: [{ id: 'att-1', name: 'John Doe', mealOption: 'option_b' }],
      }),
    ] as unknown as Awaited<
      ReturnType<typeof RsvpRepository.findEventResponsesForGuestIds>
    >);

    await setPartyEventRsvp({
      ...VALID_INPUT,
      expectedUpdatedAt: SEEDED_UPDATED_AT,
    });

    const written = mockReplaceParty.mock.calls[0][0];

    expect(written.response.id).toBe('rsvp-existing');
    expect(written.response.guestId).toBe('guest-2');
    expect(written.attendeeRows[0].rsvpResponseId).toBe('rsvp-existing');
  });

  test('should carry over meal details for a member who stays attending', async () => {
    mockAdminSession();
    mockFindResponses.mockResolvedValue([
      makeResponse({
        attendees: [
          {
            id: 'att-1',
            name: 'Jane Doe',
            mealOption: 'option_a',
            dietaryRestrictions: 'Gluten free',
          },
          { id: 'att-2', name: 'John Doe', mealOption: 'option_b' },
        ],
      }),
    ] as unknown as Awaited<
      ReturnType<typeof RsvpRepository.findEventResponsesForGuestIds>
    >);

    await setPartyEventRsvp({
      ...VALID_INPUT,
      expectedUpdatedAt: SEEDED_UPDATED_AT,
    });

    const written = mockReplaceParty.mock.calls[0][0];

    expect(written.attendeeRows).toHaveLength(1);
    expect(written.attendeeRows[0]).toMatchObject({
      name: 'Jane Doe',
      mealOption: 'option_a',
      dietaryRestrictions: 'Gluten free',
    });
  });

  test('should record a decline with no attendees when nobody attends', async () => {
    mockAdminSession();

    await setPartyEventRsvp({
      ...VALID_INPUT,
      statuses: [
        { guestId: 'guest-1', attending: false },
        { guestId: 'guest-2', attending: false },
      ],
    });

    const written = mockReplaceParty.mock.calls[0][0];

    expect(written.response.attendanceStatus).toBe('not_attending');
    expect(written.response.numberOfAttending).toBe(0);
    expect(written.attendeeRows).toEqual([]);
  });

  test('should mark attendee rows under other party responses as stale', async () => {
    mockAdminSession();
    mockFindResponses.mockResolvedValue([
      makeResponse({
        id: 'rsvp-1',
        guestId: 'guest-1',
        attendees: [{ id: 'att-1', name: 'Jane Doe' }],
      }),
      makeResponse({
        id: 'rsvp-2',
        guestId: 'guest-2',
        attendees: [
          { id: 'att-2', name: 'Jane Doe' },
          { id: 'att-3', name: 'John Doe' },
        ],
      }),
    ] as unknown as Awaited<
      ReturnType<typeof RsvpRepository.findEventResponsesForGuestIds>
    >);

    await setPartyEventRsvp({
      ...VALID_INPUT,
      expectedUpdatedAt: SEEDED_UPDATED_AT,
    });

    const written = mockReplaceParty.mock.calls[0][0];

    expect(written.response.id).toBe('rsvp-1');
    expect(written.staleAttendeeIds.sort()).toEqual(['att-2', 'att-3']);
  });

  test('should record the submitted statuses for the whole party, not just the edited guest', async () => {
    // Regression guard: a party with no response row must not have its other
    // members implicitly declined when one member's status is recorded.
    mockAdminSession();

    await setPartyEventRsvp({
      ...VALID_INPUT,
      statuses: [
        { guestId: 'guest-1', attending: false },
        { guestId: 'guest-2', attending: true },
      ],
    });

    const written = mockReplaceParty.mock.calls[0][0];

    expect(written.response.attendanceStatus).toBe('attending');
    expect(written.attendeeRows.map((row) => row.name)).toEqual(['John Doe']);
  });

  test('should revalidate every page that reads reconstructed RSVP data', async () => {
    mockAdminSession();

    await setPartyEventRsvp(VALID_INPUT);

    const paths = mockRevalidatePath.mock.calls.map((call) => call[0]);

    expect(paths).toContain('/admin/events/[eventId]/rsvps');
    expect(paths).toContain('/admin/events');
    expect(paths).toContain('/admin/guests');
    expect(paths).toContain('/admin/seating');
  });

  test('should fail when the write throws', async () => {
    mockAdminSession();
    mockReplaceParty.mockRejectedValue(new Error('d1 down'));

    const result = await setPartyEventRsvp(VALID_INPUT);

    expect(result).toEqual({
      success: false,
      error: 'Failed to update RSVP. Please try again.',
    });
  });
});
