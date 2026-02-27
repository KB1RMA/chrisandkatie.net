'use server';

/**
 * Server actions for event-specific RSVP operations.
 *
 * Handles submitting and retrieving RSVP responses for a given event,
 * enforcing authentication, invitation validation, and deadline checks.
 */
import { and, asc, eq } from 'drizzle-orm';

import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import type { DbClient } from '@/lib/db';
import {
  attendees,
  events,
  guestEvents,
  guests,
  rsvpResponses,
} from '@/lib/db/schema';
import type { Guest, WeddingEvent } from '@/lib/db/schema';
import {
  isDeadlinePassed,
  validateAttendeeAgainstInvitation,
} from '@/lib/rsvp';
import type {
  AttendeeOutput,
  EventRsvpResponse,
  SubmitEventRsvpInput,
} from '@/lib/schemas/rsvp';

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
 * Query all guests invited to a specific event via the junction table.
 *
 * @param eventId - The event ID to look up invitees for.
 * @param db - Drizzle database client.
 * @returns Array of Guest rows for all guests invited to the event.
 */
async function getEventInvitees(
  eventId: string,
  db: DbClient,
): Promise<Guest[]> {
  const guestEventRows = await db.query.guestEvents.findMany({
    where: eq(guestEvents.eventId, eventId),
    with: {
      guest: true,
    },
  });

  return guestEventRows.map((row) => row.guest);
}

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

  const db = getDb();

  // Verify the submitted guestId belongs to the session's invitation
  const submittedGuest = await db.query.guests.findFirst({
    where: eq(guests.id, input.guestId),
  });

  if (submittedGuest?.invitationId !== session.user.invitationId) {
    throw new Error('Unauthorized');
  }

  if (isDeadlinePassed()) {
    throw new Error('RSVP deadline has passed');
  }

  // Confirm guest is invited to this event
  const guestEvent = await db.query.guestEvents.findFirst({
    where: and(
      eq(guestEvents.guestId, input.guestId),
      eq(guestEvents.eventId, input.eventId),
    ),
  });

  if (!guestEvent) {
    throw new Error('Not invited to this event');
  }

  // Fetch guest with their invitation and all guests on that invitation
  const guestWithInvitation = await db.query.guests.findFirst({
    where: eq(guests.id, input.guestId),
    with: {
      invitation: {
        with: {
          guests: true,
        },
      },
    },
  });

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
  const event = await db.query.events.findFirst({
    where: eq(events.id, input.eventId),
  });

  if (!event) {
    throw new Error('Not invited to this event');
  }

  const now = new Date().toISOString();

  // Upsert the RSVP response row
  await db
    .insert(rsvpResponses)
    .values({
      id: crypto.randomUUID(),
      guestId: input.guestId,
      eventId: input.eventId,
      attendanceStatus: input.attendanceStatus,
      numberOfAttending: input.attendees.length,
      specialRequests: input.specialRequests ?? null,
      submittedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [rsvpResponses.guestId, rsvpResponses.eventId],
      set: {
        attendanceStatus: input.attendanceStatus,
        numberOfAttending: input.attendees.length,
        specialRequests: input.specialRequests ?? null,
        updatedAt: now,
      },
    });

  // Re-fetch to get the canonical ID (may differ from generated UUID on update)
  const savedRsvp = await db.query.rsvpResponses.findFirst({
    where: and(
      eq(rsvpResponses.guestId, input.guestId),
      eq(rsvpResponses.eventId, input.eventId),
    ),
  });

  if (!savedRsvp) {
    throw new Error('Failed to save RSVP');
  }

  // Replace attendees: delete existing, then insert fresh rows
  await db.delete(attendees).where(eq(attendees.rsvpResponseId, savedRsvp.id));

  const newAttendeeRows = input.attendees.map((attendee, index) => ({
    id: crypto.randomUUID(),
    rsvpResponseId: savedRsvp.id,
    name: attendee.name,
    mealOption: attendee.mealOption,
    dietaryRestrictions: attendee.dietaryRestrictions ?? null,
    sortOrder: index,
  }));

  if (newAttendeeRows.length > 0) {
    await db.insert(attendees).values(newAttendeeRows);
  }

  const attendeeOutputs: AttendeeOutput[] = newAttendeeRows.map((a) => ({
    id: a.id,
    name: a.name,
    mealOption: a.mealOption,
    dietaryRestrictions: a.dietaryRestrictions,
    sortOrder: a.sortOrder,
  }));

  return {
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
  const db = getDb();

  // Find guests for this invitation who are also invited to this event
  const invitationGuestEvents = await db.query.guestEvents.findMany({
    where: eq(guestEvents.eventId, eventId),
    with: {
      guest: true,
    },
  });

  const matchingGuestEvent = invitationGuestEvents.find(
    (row) => row.guest.invitationId === invitationId,
  );

  if (!matchingGuestEvent) {
    throw new Error('Not invited to this event');
  }

  const guestId = matchingGuestEvent.guest.id;

  // Fetch event details and existing RSVP in parallel
  const [event, existingRsvp] = await Promise.all([
    db.query.events.findFirst({
      where: eq(events.id, eventId),
    }),
    db.query.rsvpResponses.findFirst({
      where: and(
        eq(rsvpResponses.guestId, guestId),
        eq(rsvpResponses.eventId, eventId),
      ),
    }),
  ]);

  if (!event) {
    throw new Error('Not invited to this event');
  }

  // Fetch attendees only when an existing RSVP is present
  const attendeeRows = existingRsvp
    ? await db.query.attendees.findMany({
        where: eq(attendees.rsvpResponseId, existingRsvp.id),
        orderBy: asc(attendees.sortOrder),
      })
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
  const allEventInvitees = await getEventInvitees(eventId, db);
  const invitationGuests: Guest[] = allEventInvitees.filter(
    (g) => g.invitationId === invitationId,
  );

  return {
    event,
    guestId,
    rsvp,
    attendees: attendeeOutputs,
    invitationGuests,
    deadlinePassed: isDeadlinePassed(),
  };
}
