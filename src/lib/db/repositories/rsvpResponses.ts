/**
 * RsvpResponse repository — all database operations for the RsvpResponse entity.
 *
 * This module owns query and aggregation logic for RSVP responses. Server
 * Actions and other callers should use these functions instead of calling the
 * Drizzle client directly.
 */

import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { guestEvents, rsvpResponses } from '@/lib/db/schema';
import {
  normalizeName,
  reconstructEventRsvpStatuses,
  type EventReconstructionStatus,
  type EventResponseInput,
  type InvitedGuestInput,
} from '@/lib/rsvp';

export type InsertRsvpValues = typeof rsvpResponses.$inferInsert;

/** Columns that are immutable after insert and MUST NOT appear in an upsert conflict set. */
type ImmutableRsvpColumns =
  | 'id'
  | 'guestId'
  | 'eventId'
  | 'submittedAt'
  | 'createdAt';

export type UpsertRsvpConflictSet = Partial<
  Omit<typeof rsvpResponses.$inferInsert, ImmutableRsvpColumns>
>;

export type RsvpSummary = {
  attending: number;
  notAttending: number;
  noResponse: number;
  total: number;
};

/**
 * Find a single RSVP response for a guest/event pair.
 *
 * @param guestId - The guest id.
 * @param eventId - The event id.
 * @returns The RsvpResponse row, or undefined if none exists.
 */
export async function findRsvpByGuestAndEvent(
  guestId: string,
  eventId: string,
) {
  return getDb().query.rsvpResponses.findFirst({
    where: and(
      eq(rsvpResponses.guestId, guestId),
      eq(rsvpResponses.eventId, eventId),
    ),
  });
}

/**
 * Find an RSVP response by its primary key.
 *
 * @param id - The RsvpResponse id.
 * @returns The RsvpResponse row, or undefined if not found.
 */
export async function findRsvpById(id: string) {
  return getDb().query.rsvpResponses.findFirst({
    where: eq(rsvpResponses.id, id),
  });
}

/**
 * Fetch all RSVP responses for a list of guest ids.
 *
 * @param guestIds - Guest ids to fetch responses for.
 * @returns All matching RsvpResponse rows.
 */
export async function findRsvpsByGuestIds(guestIds: string[]) {
  return getDb()
    .select()
    .from(rsvpResponses)
    .where(inArray(rsvpResponses.guestId, guestIds));
}

/**
 * Insert a new RSVP response, or update specific fields if the guest/event
 * pair already has a row (upsert).
 *
 * @param values - The full row values for the new response.
 * @param onConflictSet - Fields to update when a row already exists.
 */
export async function upsertRsvpResponse(
  values: InsertRsvpValues,
  onConflictSet: UpsertRsvpConflictSet,
): Promise<void> {
  await getDb()
    .insert(rsvpResponses)
    .values(values)
    .onConflictDoUpdate({
      target: [rsvpResponses.guestId, rsvpResponses.eventId],
      set: onConflictSet,
    });
}

/**
 * Insert a new RSVP response row.
 *
 * @param values - Column values for the new row.
 */
export async function insertRsvpResponse(
  values: InsertRsvpValues,
): Promise<void> {
  await getDb().insert(rsvpResponses).values(values);
}

/**
 * Update the attendanceStatus and updatedAt on an existing RSVP response.
 *
 * @param id - The RsvpResponse id to update.
 * @param attendanceStatus - The new attendance status.
 * @param now - ISO timestamp to use for updatedAt.
 */
export async function updateRsvpAttendanceStatus(
  id: string,
  attendanceStatus: 'attending' | 'not_attending',
  now: string,
): Promise<void> {
  await getDb()
    .update(rsvpResponses)
    .set({ attendanceStatus, updatedAt: now })
    .where(eq(rsvpResponses.id, id));
}

/**
 * Mark every RSVP response for a guest as not_attending.
 *
 * Used for cascade-not-attending workflows.
 *
 * @param guestId - The guest whose all responses should be updated.
 * @param now - ISO timestamp to use for updatedAt.
 */
export async function updateAllRsvpsNotAttendingForGuest(
  guestId: string,
  now: string,
): Promise<void> {
  await getDb()
    .update(rsvpResponses)
    .set({ attendanceStatus: 'not_attending', updatedAt: now })
    .where(eq(rsvpResponses.guestId, guestId));
}

/**
 * Mark a guest's RSVP response for a specific event as not_attending.
 *
 * @param guestId - The guest id.
 * @param eventId - The event id.
 * @param now - ISO timestamp to use for updatedAt.
 */
export async function updateRsvpNotAttendingForGuestAndEvent(
  guestId: string,
  eventId: string,
  now: string,
): Promise<void> {
  await getDb()
    .update(rsvpResponses)
    .set({ attendanceStatus: 'not_attending', updatedAt: now })
    .where(
      and(
        eq(rsvpResponses.guestId, guestId),
        eq(rsvpResponses.eventId, eventId),
      ),
    );
}

/**
 * Delete all RSVP responses for a list of guest ids.
 *
 * Used when resetting an invitation's RSVP state so event-specific responses
 * are cleared alongside the main Guest attendance fields.
 *
 * @param guestIds - The ids of the guests whose responses should be removed.
 */
export async function deleteRsvpResponsesByGuestIds(
  guestIds: string[],
): Promise<void> {
  if (guestIds.length === 0) {
    return;
  }

  await getDb()
    .delete(rsvpResponses)
    .where(inArray(rsvpResponses.guestId, guestIds));
}

/**
 * Bump the updatedAt timestamp on an RSVP response.
 *
 * @param id - The RsvpResponse id to touch.
 * @param now - ISO timestamp to write.
 */
export async function updateRsvpTimestamp(
  id: string,
  now: string,
): Promise<void> {
  await getDb()
    .update(rsvpResponses)
    .set({ updatedAt: now })
    .where(eq(rsvpResponses.id, id));
}

/**
 * A single invited guest's reconstructed RSVP for an event.
 *
 * Status is derived from data as it is stored: attending people are recorded as
 * attendee name rows under their party's response, so non-submitting party
 * members are resolved by matching their name against the party's attendees.
 */
export type EventRsvpGuestRow = {
  guestId: string;
  firstName: string;
  lastName: string;
  invitationId: string;
  partyName: string;
  notes: string | null;
  status: EventReconstructionStatus;
  mealOption: string | null;
  dietaryRestrictions: string | null;
  specialRequests: string | null;
};

export type EventRsvpReconstructionResult = {
  rows: EventRsvpGuestRow[];
  summary: RsvpSummary;
};

/**
 * Reconstruct per-person RSVP status for an event from stored data.
 *
 * Loads every invited guest, every response for the event (with the responder's
 * invitation and attendee names), then resolves each guest's true status by
 * matching their name against their party's attending attendees. This corrects
 * for the storage model where only the submitting guest of a party has a
 * response row while the rest are recorded as attendee names.
 *
 * @param eventId - The event to reconstruct RSVPs for.
 * @returns Per-guest rows enriched with party/meal data and the aggregated summary.
 */
export async function getEventRsvpReconstruction(
  eventId: string,
): Promise<EventRsvpReconstructionResult> {
  const db = getDb();

  const [invitedGuestRows, responseRows] = await Promise.all([
    db.query.guestEvents.findMany({
      where: eq(guestEvents.eventId, eventId),
      with: { guest: { with: { invitation: true } } },
    }),
    db.query.rsvpResponses.findMany({
      where: eq(rsvpResponses.eventId, eventId),
      with: { guest: true, attendees: true },
    }),
  ]);

  const invitedGuests: InvitedGuestInput[] = invitedGuestRows.map((row) => ({
    guestId: row.guest.id,
    firstName: row.guest.firstName,
    lastName: row.guest.lastName,
    invitationId: row.guest.invitationId,
  }));

  const responses: EventResponseInput[] = responseRows.map((response) => ({
    invitationId: response.guest.invitationId,
    attendanceStatus: response.attendanceStatus,
    attendeeNames: response.attendees.map((attendee) => attendee.name),
  }));

  const { statuses, summary } = reconstructEventRsvpStatuses(
    invitedGuests,
    responses,
  );

  // Party-level special requests, keyed by invitation
  const specialRequestsByInvitation = new Map<string, string>();

  responseRows.forEach((response) => {
    if (
      response.specialRequests &&
      !specialRequestsByInvitation.has(response.guest.invitationId)
    ) {
      specialRequestsByInvitation.set(
        response.guest.invitationId,
        response.specialRequests,
      );
    }
  });

  // Matched attendee details (meal/dietary) keyed by "invitationId|normalizedName"
  const attendeeDetailByKey = new Map<
    string,
    { mealOption: string | null; dietaryRestrictions: string | null }
  >();

  responseRows.forEach((response) => {
    response.attendees.forEach((attendee) => {
      const key = `${response.guest.invitationId}|${normalizeName(attendee.name)}`;

      if (!attendeeDetailByKey.has(key)) {
        attendeeDetailByKey.set(key, {
          mealOption: attendee.mealOption ?? null,
          dietaryRestrictions: attendee.dietaryRestrictions ?? null,
        });
      }
    });
  });

  const statusByGuestId = new Map(statuses.map((s) => [s.guestId, s.status]));

  const rows: EventRsvpGuestRow[] = invitedGuestRows.map((row) => {
    const guest = row.guest;
    const status = statusByGuestId.get(guest.id) ?? 'no_response';
    const partyName =
      guest.invitation?.mailingAddress?.trim() ||
      `${guest.firstName} ${guest.lastName}`;
    const attendeeDetail = attendeeDetailByKey.get(
      `${guest.invitationId}|${normalizeName(`${guest.firstName} ${guest.lastName}`)}`,
    );

    return {
      guestId: guest.id,
      firstName: guest.firstName,
      lastName: guest.lastName,
      invitationId: guest.invitationId,
      partyName,
      notes: guest.notes ?? null,
      status,
      mealOption: attendeeDetail?.mealOption ?? null,
      dietaryRestrictions: attendeeDetail?.dietaryRestrictions ?? null,
      // Special requests are recorded at the party level. Only surface them on
      // attending guests so a declined member is not shown an unrelated note.
      specialRequests:
        status === 'attending'
          ? (specialRequestsByInvitation.get(guest.invitationId) ?? null)
          : null,
    };
  });

  return { rows, summary };
}

/**
 * Aggregate RSVP attendance counts for a single event.
 *
 * Counts are per person, reconstructed from stored data: attending people are
 * recorded as attendee name rows under their party's response, so members who
 * did not personally submit a response are still attributed correctly.
 *
 * @param eventId - The id of the event to summarise.
 * @returns Aggregated per-person attendance counts.
 */
export async function getRsvpSummaryForEvent(
  eventId: string,
): Promise<RsvpSummary> {
  const { summary } = await getEventRsvpReconstruction(eventId);

  return summary;
}
