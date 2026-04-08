'use server';

/**
 * Server actions for event-specific RSVP operations.
 *
 * Handles submitting and retrieving RSVP responses for a given event,
 * enforcing authentication, invitation validation, and deadline checks.
 */
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/lib/auth';
import { createLogger } from '@/lib/logger';
import type { Guest, WeddingEvent } from '@/lib/db/schema';

const logger = createLogger('event-rsvp-actions');
import {
  isDeadlinePassed,
  validateAttendeeAgainstInvitation,
} from '@/lib/rsvp';
import type {
  AttendeeOutput,
  EventRsvpResponse,
  SubmitEventRsvpInput,
} from '@/lib/schemas/rsvp';
import { buildNotificationPayload } from '@/lib/email/notification';
import * as EventRepository from '@/lib/db/repositories/events';
import * as GuestRepository from '@/lib/db/repositories/guests';
import * as GuestEventRepository from '@/lib/db/repositories/guestEvents';
import * as RsvpRepository from '@/lib/db/repositories/rsvpResponses';
import * as AttendeeRepository from '@/lib/db/repositories/attendees';

/**
 * Return type for retrieveEventRsvp.
 */
type RetrieveEventRsvpResult = {
  event: WeddingEvent;
  guestId: string;
  rsvp: EventRsvpResponse | null;
  attendees: AttendeeOutput[];
  invitationGuests: Guest[];
  deadlinePassed: boolean;
};

/**
 * Submit or update an RSVP response for a specific event.
 *
 * Validates authentication, invitation membership, attendee names against
 * the registered guest list, and the RSVP deadline before persisting.
 *
 * @param input - Validated RSVP submission data including attendees.
 * @returns The saved EventRsvpResponse with updated attendees.
 * @throws Error('Unauthorized') if the session is missing or guestId does not match.
 * @throws Error('Not invited to this event') if the guest is not in the event's junction table.
 * @throws Error('RSVP deadline has passed') if the submission window has closed.
 */
export async function submitEventRsvp(
  input: SubmitEventRsvpInput,
): Promise<EventRsvpResponse> {
  const session = await auth();

  if (!session?.user?.invitationId) {
    throw new Error('Unauthorized');
  }

  // Verify the submitted guestId belongs to the session's invitation
  const submittedGuest = await GuestRepository.findGuestById(input.guestId);

  if (submittedGuest?.invitationId !== session.user.invitationId) {
    throw new Error('Unauthorized');
  }

  if (isDeadlinePassed()) {
    throw new Error('RSVP deadline has passed');
  }

  // Confirm guest is invited to this event
  const guestEvent = await GuestEventRepository.findGuestEventByGuestAndEvent(
    input.guestId,
    input.eventId,
  );

  if (!guestEvent) {
    throw new Error('Not invited to this event');
  }

  // Fetch guest with their invitation and all guests on that invitation
  const guestWithInvitation =
    await GuestRepository.findGuestWithInvitationAndPeers(input.guestId);

  if (!guestWithInvitation?.invitation) {
    throw new Error('Not invited to this event');
  }

  const registeredNames = guestWithInvitation.invitation.guests.map(
    (g) => `${g.firstName} ${g.lastName}`,
  );
  const attendeeNames = input.attendees.map((a) => a.name);
  const validationErrors = validateAttendeeAgainstInvitation(
    attendeeNames,
    registeredNames,
    guestWithInvitation.invitation.totalInvited,
  );

  if (validationErrors.length > 0) {
    throw new Error(validationErrors[0]);
  }

  // Fetch event record for building the response
  const event = await EventRepository.findEventById(input.eventId);

  if (!event) {
    throw new Error('Not invited to this event');
  }

  const isMainEvent = event.type === 'main';

  // For main events every attending attendee must have a meal option selected.
  if (isMainEvent && input.attendanceStatus === 'attending') {
    const missingMeal = input.attendees.some((a) => !a.mealOption);

    if (missingMeal) {
      throw new Error(
        'Meal option is required for all attendees at this event',
      );
    }
  }

  // Check whether a prior RSVP exists before upserting (determines isUpdate flag)
  const existingRsvpBeforeUpsert = await RsvpRepository.findRsvpByGuestAndEvent(
    input.guestId,
    input.eventId,
  );

  const isUpdate = existingRsvpBeforeUpsert !== undefined;

  const now = new Date().toISOString();

  // Upsert the RSVP response row
  await RsvpRepository.upsertRsvpResponse(
    {
      id: crypto.randomUUID(),
      guestId: input.guestId,
      eventId: input.eventId,
      attendanceStatus: input.attendanceStatus,
      numberOfAttending: input.attendees.length,
      specialRequests: isMainEvent ? (input.specialRequests ?? null) : null,
      submittedAt: now,
      updatedAt: now,
    },
    {
      attendanceStatus: input.attendanceStatus,
      numberOfAttending: input.attendees.length,
      specialRequests: isMainEvent ? (input.specialRequests ?? null) : null,
      updatedAt: now,
    },
  );

  // Re-fetch to get the canonical ID (may differ from generated UUID on update)
  const savedRsvp = await RsvpRepository.findRsvpByGuestAndEvent(
    input.guestId,
    input.eventId,
  );

  if (!savedRsvp) {
    throw new Error('Failed to save RSVP');
  }

  // Replace attendees: delete existing, then insert fresh rows
  const newAttendeeRows = input.attendees.map((attendee, index) => ({
    id: crypto.randomUUID(),
    rsvpResponseId: savedRsvp.id,
    name: attendee.name,
    mealOption: isMainEvent ? (attendee.mealOption ?? null) : null,
    dietaryRestrictions: attendee.dietaryRestrictions ?? null,
    sortOrder: index,
  }));

  await AttendeeRepository.replaceAttendees(savedRsvp.id, newAttendeeRows);

  const attendeeOutputs: AttendeeOutput[] = newAttendeeRows.map((a) => ({
    id: a.id,
    name: a.name,
    mealOption: a.mealOption,
    dietaryRestrictions: a.dietaryRestrictions,
    sortOrder: a.sortOrder,
  }));

  const response: EventRsvpResponse = {
    id: savedRsvp.id,
    guestId: savedRsvp.guestId,
    eventId: savedRsvp.eventId,
    eventName: event.name,
    eventType: event.type,
    attendanceStatus: savedRsvp.attendanceStatus,
    numberOfAttending: savedRsvp.numberOfAttending,
    specialRequests: savedRsvp.specialRequests ?? null,
    attendees: attendeeOutputs,
    submittedAt: savedRsvp.submittedAt,
    updatedAt: savedRsvp.updatedAt,
  };

  // Fire-and-forget: enqueue notification email — failure must never block the RSVP save
  try {
    const guestName = submittedGuest
      ? `${submittedGuest.firstName} ${submittedGuest.lastName}`
      : (input.attendees[0]?.name ?? 'Guest');

    const payload = buildNotificationPayload(response, guestName, isUpdate);
    const context = getCloudflareContext();

    await context.env.RSVP_NOTIFICATION_QUEUE?.send(payload, {
      contentType: 'json',
    });
  } catch (error) {
    logger.warn(
      { err: error, guestId: response.guestId, eventId: response.eventId },
      'Failed to enqueue notification',
    );
  }

  return response;
}

/**
 * Retrieve event details and the current guest's RSVP for a given event.
 *
 * Validates authentication and event invitation membership before fetching
 * event data, existing RSVP, attendees, and the full invitation guest list.
 *
 * @param eventId - The event ID to retrieve RSVP data for.
 * @returns Event details, existing RSVP (or null), attendees, invitation guests, and deadline status.
 * @throws Error('Unauthorized') if no valid session exists.
 * @throws Error('Not invited to this event') if the guest is not invited.
 */
export async function retrieveEventRsvp(
  eventId: string,
): Promise<RetrieveEventRsvpResult> {
  const session = await auth();

  if (!session?.user?.invitationId) {
    throw new Error('Unauthorized');
  }

  const invitationId = session.user.invitationId;

  // Find guests for this invitation who are also invited to this event
  const invitationGuestEvents =
    await GuestEventRepository.findGuestEventsForEvent(eventId);

  const matchingGuestEvent = invitationGuestEvents.find(
    (row) => row.guest.invitationId === invitationId,
  );

  if (!matchingGuestEvent) {
    throw new Error('Not invited to this event');
  }

  const guestId = matchingGuestEvent.guest.id;

  // Fetch event details and existing RSVP in parallel
  const [event, existingRsvp] = await Promise.all([
    EventRepository.findEventById(eventId),
    RsvpRepository.findRsvpByGuestAndEvent(guestId, eventId),
  ]);

  if (!event) {
    throw new Error('Not invited to this event');
  }

  if (!event.rsvpRequired) {
    throw new Error('Not invited to this event');
  }

  // Fetch attendees only when an existing RSVP is present
  const attendeeRows = existingRsvp
    ? await AttendeeRepository.findAttendeesByRsvpResponseId(existingRsvp.id)
    : [];

  const attendeeOutputs: AttendeeOutput[] = attendeeRows.map((a) => ({
    id: a.id,
    name: a.name,
    mealOption: a.mealOption,
    dietaryRestrictions: a.dietaryRestrictions ?? null,
    sortOrder: a.sortOrder,
  }));

  const rsvp: EventRsvpResponse | null = existingRsvp
    ? {
        id: existingRsvp.id,
        guestId: existingRsvp.guestId,
        eventId: existingRsvp.eventId,
        eventName: event.name,
        eventType: event.type,
        attendanceStatus: existingRsvp.attendanceStatus,
        numberOfAttending: existingRsvp.numberOfAttending,
        specialRequests: existingRsvp.specialRequests ?? null,
        attendees: attendeeOutputs,
        submittedAt: existingRsvp.submittedAt,
        updatedAt: existingRsvp.updatedAt,
      }
    : null;

  // Filter to all guests on the same invitation who are also invited to this event
  const invitationGuests: Guest[] = invitationGuestEvents
    .map((row) => row.guest)
    .filter((g) => g.invitationId === invitationId);

  return {
    event,
    guestId,
    rsvp,
    attendees: attendeeOutputs,
    invitationGuests,
    deadlinePassed: isDeadlinePassed(),
  };
}
