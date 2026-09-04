/**
 * RsvpResponse repository — all database operations for the RsvpResponse entity.
 *
 * This module owns query and aggregation logic for RSVP responses. Server
 * Actions and other callers should use these functions instead of calling the
 * Drizzle client directly.
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { attendees, guestEvents, rsvpResponses } from '@/lib/db/schema';
import type { InsertAttendeeValues } from '@/lib/db/repositories/attendees';
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
  'id' | 'guestId' | 'eventId' | 'submittedAt' | 'createdAt';

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
  /**
   * The legacy per-guest `attending` flag written by the main RSVP wizard.
   * Parties that responded through that wizard have no RsvpResponse row, so
   * this is the only record of their intent for the main event.
   */
  legacyAttending: boolean | null;
  /** Whether the guest's party has any response row for this event. */
  hasPartyResponse: boolean;
  /**
   * The most recent `updatedAt` across the party's responses for this event,
   * or null when the party has not responded. Callers editing a party's RSVP
   * pass this back so a concurrent change can be detected before overwriting.
   */
  partyRsvpUpdatedAt: string | null;
  contactEmail: string | null;
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

  const respondedInvitationIds = new Set(
    responseRows.map((response) => response.guest.invitationId),
  );

  // Latest write per party, used as the concurrency token for admin edits.
  const updatedAtByInvitation = responseRows.reduce((acc, response) => {
    const current = acc.get(response.guest.invitationId);

    return !current || response.updatedAt > current
      ? acc.set(response.guest.invitationId, response.updatedAt)
      : acc;
  }, new Map<string, string>());

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
      legacyAttending: guest.attending ?? null,
      hasPartyResponse: respondedInvitationIds.has(guest.invitationId),
      partyRsvpUpdatedAt: updatedAtByInvitation.get(guest.invitationId) ?? null,
      contactEmail: guest.invitation?.contactEmail ?? null,
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

/** A single meal option count among attending guests of an event. */
export type MealBreakdownItem = {
  mealOption: 'option_a' | 'option_b';
  count: number;
};

/**
 * Aggregate meal option counts for attending guests of an event.
 *
 * Counts attendee rows grouped by meal option, restricted to responses for
 * the given event with status 'attending'. Attendees who have not selected
 * a meal option are excluded.
 *
 * @param eventId - The id of the event to summarise.
 * @returns One `MealBreakdownItem` per selected meal option.
 */
export async function findMealBreakdownForEvent(
  eventId: string,
): Promise<MealBreakdownItem[]> {
  const rows = await getDb()
    .select({
      mealOption: attendees.mealOption,
      count: sql<number>`count(*)`,
    })
    .from(attendees)
    .innerJoin(rsvpResponses, eq(attendees.rsvpResponseId, rsvpResponses.id))
    .where(
      and(
        eq(rsvpResponses.eventId, eventId),
        eq(rsvpResponses.attendanceStatus, 'attending'),
      ),
    )
    .groupBy(attendees.mealOption);

  return rows
    .filter((row) => row.mealOption !== null)
    .map((row) => ({
      mealOption: row.mealOption as MealBreakdownItem['mealOption'],
      count: Number(row.count),
    }));
}

/**
 * The flattened shape returned by `findEventRsvpRowsForExport`.
 *
 * One row per invited guest, with status and meal details reconstructed the
 * same way as the admin RSVP dashboard (see `getEventRsvpReconstruction`).
 */
export type EventRsvpExportRow = {
  guestId: string;
  guestFirstName: string;
  guestLastName: string;
  partyName: string;
  attendanceStatus: EventReconstructionStatus;
  specialRequests: string | null;
  guestNotes: string | null;
  mealOption: string | null;
  dietaryRestrictions: string | null;
};

/**
 * Return all invited guests for an event with their reconstructed RSVP
 * status and meal details, flattened for CSV export.
 *
 * Built on `getEventRsvpReconstruction` so the export always matches what
 * the admin RSVP dashboard shows. Ordered by guest last name, then first
 * name.
 *
 * @param eventId - The id of the event to export.
 * @returns One `EventRsvpExportRow` per invited guest.
 */
export async function findEventRsvpRowsForExport(
  eventId: string,
): Promise<EventRsvpExportRow[]> {
  const { rows } = await getEventRsvpReconstruction(eventId);

  return [...rows]
    .sort(
      (a, b) =>
        a.lastName.localeCompare(b.lastName) ||
        a.firstName.localeCompare(b.firstName),
    )
    .map((row) => ({
      guestId: row.guestId,
      guestFirstName: row.firstName,
      guestLastName: row.lastName,
      partyName: row.partyName,
      attendanceStatus: row.status,
      specialRequests: row.specialRequests,
      guestNotes: row.notes,
      mealOption: row.mealOption,
      dietaryRestrictions: row.dietaryRestrictions,
    }));
}

/**
 * Fetch every response for an event that belongs to one of the given guests,
 * with their attendee rows eagerly loaded.
 *
 * Used to load a single party's stored RSVP before an admin rewrites it.
 *
 * @param eventId - The event to fetch responses for.
 * @param guestIds - The guest ids making up the party.
 * @returns Matching RsvpResponse rows, each with its attendees.
 */
export async function findEventResponsesForGuestIds(
  eventId: string,
  guestIds: string[],
) {
  if (guestIds.length === 0) {
    return [];
  }

  return getDb().query.rsvpResponses.findMany({
    where: and(
      eq(rsvpResponses.eventId, eventId),
      inArray(rsvpResponses.guestId, guestIds),
    ),
    with: { attendees: true },
  });
}

/** The statements needed to rewrite one party's RSVP for an event. */
export type ReplacePartyEventRsvpInput = {
  /** Full row values, used when the party has no response for this event yet. */
  response: InsertRsvpValues;
  /** Fields to write when a response already exists for this guest/event pair. */
  responseUpdate: UpsertRsvpConflictSet;
  /** The complete new attendee list for the response. */
  attendeeRows: InsertAttendeeValues[];
  /**
   * Attendee rows to delete from *other* responses belonging to the same party,
   * so an edited member cannot linger under a second response row.
   */
  staleAttendeeIds: string[];
};

/**
 * Rewrite a party's RSVP for an event as a single atomic batch.
 *
 * Upserts the party's response row, clears its attendees, drops any stale
 * attendee rows left under other responses from the same party, then inserts
 * the new attendee list. D1 has no interactive transactions, so the statements
 * are sent through the batch API; the response upsert is ordered first because
 * the attendee rows reference it.
 *
 * @param input - The response values, new attendee rows, and stale attendee ids.
 */
export async function replacePartyEventRsvp(
  input: ReplacePartyEventRsvpInput,
): Promise<void> {
  const db = getDb();

  const upsert = db
    .insert(rsvpResponses)
    .values(input.response)
    .onConflictDoUpdate({
      target: [rsvpResponses.guestId, rsvpResponses.eventId],
      set: input.responseUpdate,
    });

  const clearAttendees = db
    .delete(attendees)
    .where(eq(attendees.rsvpResponseId, input.response.id));

  const clearStale =
    input.staleAttendeeIds.length > 0
      ? [
          db
            .delete(attendees)
            .where(inArray(attendees.id, input.staleAttendeeIds)),
        ]
      : [];

  const insertAttendees =
    input.attendeeRows.length > 0
      ? [db.insert(attendees).values(input.attendeeRows)]
      : [];

  await db.batch([upsert, clearAttendees, ...clearStale, ...insertAttendees]);
}
