/**
 * @vitest-environment node
 */

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/rsvp', () => ({
  isDeadlinePassed: vi.fn().mockReturnValue(false),
  validateAttendeeAgainstInvitation: vi.fn().mockReturnValue([]),
}));

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn(),
}));

vi.mock('@/lib/db/repositories/guestEvents', () => ({
  findGuestEventByGuestAndEvent: vi.fn(),
  findGuestEventsForEvent: vi.fn(),
}));

vi.mock('@/lib/db/repositories/events', () => ({
  findEventById: vi.fn(),
}));

vi.mock('@/lib/db/repositories/guests', () => ({
  findGuestById: vi.fn(),
  findGuestWithInvitationAndPeers: vi.fn(),
}));

vi.mock('@/lib/db/repositories/rsvpResponses', () => ({
  findRsvpByGuestAndEvent: vi.fn(),
  upsertRsvpResponse: vi.fn(),
}));

vi.mock('@/lib/db/repositories/attendees', () => ({
  findAttendeesByRsvpResponseId: vi.fn(),
  replaceAttendees: vi.fn(),
}));

import { expect, test, describe, beforeEach, vi } from 'vitest';
import { makeSession } from '@/tests/helpers';
import { auth } from '@/lib/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import * as GuestEventRepository from '@/lib/db/repositories/guestEvents';
import * as EventRepository from '@/lib/db/repositories/events';
import * as GuestRepository from '@/lib/db/repositories/guests';
import * as RsvpRepository from '@/lib/db/repositories/rsvpResponses';
import * as AttendeeRepository from '@/lib/db/repositories/attendees';
import type { WeddingEvent } from '@/lib/db/schema';
import { retrieveEventRsvp, submitEventRsvp } from './actions';

const mockAuth = vi.mocked(auth);
const mockGetCloudflareContext = vi.mocked(getCloudflareContext);

function makeEvent(overrides: Partial<WeddingEvent> = {}): WeddingEvent {
  return {
    id: 'event-1',
    name: 'Test Event',
    description: null,
    location: null,
    eventDate: '2026-09-12',
    startTime: '10:00',
    endTime: '11:00',
    type: 'other' as const,
    dressCode: null,
    parkingInfo: null,
    locationLat: null,
    locationLng: null,
    sortOrder: 0,
    rsvpRequired: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('retrieveEventRsvp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should throw "Not invited to this event" when event.rsvpRequired is false', async () => {
    const invitationId = 'invite-1';

    mockAuth.mockResolvedValue(makeSession({ invitationId }));

    vi.mocked(GuestEventRepository.findGuestEventsForEvent).mockResolvedValue([
      { guest: { id: 'guest-1', invitationId } } as never,
    ]);

    vi.mocked(EventRepository.findEventById).mockResolvedValue(
      makeEvent({ rsvpRequired: false }),
    );

    vi.mocked(RsvpRepository.findRsvpByGuestAndEvent).mockResolvedValue(
      undefined,
    );

    await expect(retrieveEventRsvp('event-1')).rejects.toThrow(
      'Not invited to this event',
    );
  });
});

describe('submitEventRsvp', () => {
  const invitationId = 'invite-1';
  const guestId = 'guest-1';
  const eventId = 'event-1';

  const validInput = {
    guestId,
    eventId,
    attendanceStatus: 'attending' as const,
    attendees: [
      {
        name: 'Chris Smith',
        mealOption: 'option_a' as const,
        dietaryRestrictions: null,
      },
    ],
    specialRequests: null,
  };

  const savedRsvpRow = {
    id: 'rsvp-1',
    guestId,
    eventId,
    attendanceStatus: 'attending' as const,
    numberOfAttending: 1,
    specialRequests: null,
    submittedAt: '2026-09-12T10:00:00.000Z',
    updatedAt: '2026-09-12T10:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Auth session
    mockAuth.mockResolvedValue(makeSession({ invitationId }));

    // Guest belongs to this invitation
    vi.mocked(GuestRepository.findGuestById).mockResolvedValue({
      id: guestId,
      invitationId,
      firstName: 'Chris',
      lastName: 'Smith',
    } as never);

    // Guest is invited to the event
    vi.mocked(
      GuestEventRepository.findGuestEventByGuestAndEvent,
    ).mockResolvedValue({ guestId, eventId } as never);

    // Guest has invitation with peers
    vi.mocked(
      GuestRepository.findGuestWithInvitationAndPeers,
    ).mockResolvedValue({
      id: guestId,
      invitation: {
        totalInvited: 2,
        guests: [{ firstName: 'Chris', lastName: 'Smith' }],
      },
    } as never);

    // Event exists and requires RSVP
    vi.mocked(EventRepository.findEventById).mockResolvedValue(
      makeEvent({ name: 'Wedding Reception' }),
    );

    // Upsert succeeds silently
    vi.mocked(RsvpRepository.upsertRsvpResponse).mockResolvedValue(undefined);

    // Replace attendees succeeds silently
    vi.mocked(AttendeeRepository.replaceAttendees).mockResolvedValue(undefined);
  });

  test('should call RSVP_NOTIFICATION_QUEUE.send() after a successful RSVP save', async () => {
    const mockQueueSend = vi.fn().mockResolvedValue(undefined);

    mockGetCloudflareContext.mockReturnValue({
      env: {
        RSVP_NOTIFICATION_QUEUE: { send: mockQueueSend },
      },
    } as never);

    // Pre-upsert: no existing RSVP → isUpdate: false
    // Post-upsert: saved RSVP row
    vi.mocked(RsvpRepository.findRsvpByGuestAndEvent)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(savedRsvpRow as never);

    await submitEventRsvp(validInput);

    expect(mockQueueSend).toHaveBeenCalledOnce();

    const [payload, options] = mockQueueSend.mock.calls[0];

    expect(payload).toMatchObject({
      isUpdate: false,
      guestName: 'Chris Smith',
      eventName: 'Wedding Reception',
      attendanceStatus: 'attending',
    });
    expect(options).toEqual({ contentType: 'json' });
  });

  test('should not throw when RSVP_NOTIFICATION_QUEUE.send() fails', async () => {
    const mockQueueSend = vi.fn().mockRejectedValue(new Error('Queue error'));

    mockGetCloudflareContext.mockReturnValue({
      env: {
        RSVP_NOTIFICATION_QUEUE: { send: mockQueueSend },
      },
    } as never);

    vi.mocked(RsvpRepository.findRsvpByGuestAndEvent)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(savedRsvpRow as never);

    // Should resolve without throwing despite queue failure
    await expect(submitEventRsvp(validInput)).resolves.toBeDefined();
  });

  test('should call RSVP_NOTIFICATION_QUEUE.send() with isUpdate: true when prior RSVP exists', async () => {
    const mockQueueSend = vi.fn().mockResolvedValue(undefined);

    mockGetCloudflareContext.mockReturnValue({
      env: {
        RSVP_NOTIFICATION_QUEUE: { send: mockQueueSend },
      },
    } as never);

    // Pre-upsert: existing RSVP found → isUpdate: true
    // Post-upsert: saved RSVP row
    vi.mocked(RsvpRepository.findRsvpByGuestAndEvent)
      .mockResolvedValueOnce(savedRsvpRow as never)
      .mockResolvedValueOnce(savedRsvpRow as never);

    await submitEventRsvp(validInput);

    expect(mockQueueSend).toHaveBeenCalledOnce();

    const [payload] = mockQueueSend.mock.calls[0];

    expect(payload.isUpdate).toBe(true);
  });

  test('should succeed when attendees have mealOption: null (non-main event)', async () => {
    const mockQueueSend = vi.fn().mockResolvedValue(undefined);

    mockGetCloudflareContext.mockReturnValue({
      env: {
        RSVP_NOTIFICATION_QUEUE: { send: mockQueueSend },
      },
    } as never);

    vi.mocked(RsvpRepository.findRsvpByGuestAndEvent)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(savedRsvpRow as never);

    const inputWithNullMealOption = {
      guestId,
      eventId,
      attendanceStatus: 'attending' as const,
      attendees: [
        {
          name: 'Chris Smith',
          mealOption: null,
          dietaryRestrictions: null,
        },
      ],
      specialRequests: null,
    };

    const result = await submitEventRsvp(inputWithNullMealOption);

    expect(result.attendanceStatus).toBe('attending');
    expect(result.attendees[0].mealOption).toBeNull();
  });

  test('should throw when a main-event attendee is attending without a mealOption', async () => {
    vi.mocked(EventRepository.findEventById).mockResolvedValue(
      makeEvent({ type: 'main', name: 'Wedding Reception' }),
    );

    const inputMissingMeal = {
      guestId,
      eventId,
      attendanceStatus: 'attending' as const,
      attendees: [
        { name: 'Chris Smith', mealOption: null, dietaryRestrictions: null },
      ],
      specialRequests: null,
    };

    await expect(submitEventRsvp(inputMissingMeal)).rejects.toThrow(
      'Meal option is required for all attendees at this event',
    );
  });

  test('should strip mealOption and specialRequests when persisting a non-main event RSVP', async () => {
    const mockQueueSend = vi.fn().mockResolvedValue(undefined);

    mockGetCloudflareContext.mockReturnValue({
      env: { RSVP_NOTIFICATION_QUEUE: { send: mockQueueSend } },
    } as never);

    vi.mocked(RsvpRepository.findRsvpByGuestAndEvent)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(savedRsvpRow as never);

    const inputWithExtras = {
      guestId,
      eventId,
      attendanceStatus: 'attending' as const,
      attendees: [
        {
          name: 'Chris Smith',
          mealOption: 'option_a' as const,
          dietaryRestrictions: null,
        },
      ],
      specialRequests: 'No nuts please',
    };

    const result = await submitEventRsvp(inputWithExtras);

    // mealOption and specialRequests should be null in the persisted output
    expect(result.attendees[0].mealOption).toBeNull();
    expect(result.specialRequests).toBeNull();

    const upsertCall = vi.mocked(RsvpRepository.upsertRsvpResponse).mock
      .calls[0];

    expect(upsertCall[0].specialRequests).toBeNull();
    expect(upsertCall[1].specialRequests).toBeNull();
  });
});
