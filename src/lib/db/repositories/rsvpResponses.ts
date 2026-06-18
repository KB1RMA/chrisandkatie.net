/**
 * RsvpResponse repository — all database operations for the RsvpResponse entity.
 *
 * This module owns query and aggregation logic for RSVP responses. Server
 * Actions and other callers should use these functions instead of calling the
 * Drizzle client directly.
 */

import { and, countDistinct, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { guestEvents, guests, rsvpResponses } from '@/lib/db/schema';

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
 * Aggregate RSVP attendance counts for a single event, counted at the
 * invitation level rather than per guest.
 *
 * Counts distinct invitations with any guest invited to the event (total),
 * then distinct invitations with an attending or not_attending rsvpResponse.
 * noResponse is derived as total minus the two known statuses.
 *
 * @param eventId - The id of the event to summarise.
 * @returns Aggregated attendance counts per invitation.
 */
export async function getRsvpSummaryForEvent(
  eventId: string,
): Promise<RsvpSummary> {
  const db = getDb();

  const [totalResult, attendingResult, notAttendingResult] = await Promise.all([
    db
      .select({ count: countDistinct(guests.invitationId) })
      .from(guestEvents)
      .innerJoin(guests, eq(guestEvents.guestId, guests.id))
      .where(eq(guestEvents.eventId, eventId)),
    db
      .select({ count: countDistinct(guests.invitationId) })
      .from(rsvpResponses)
      .innerJoin(guests, eq(rsvpResponses.guestId, guests.id))
      .where(
        and(
          eq(rsvpResponses.eventId, eventId),
          eq(rsvpResponses.attendanceStatus, 'attending'),
        ),
      ),
    db
      .select({ count: countDistinct(guests.invitationId) })
      .from(rsvpResponses)
      .innerJoin(guests, eq(rsvpResponses.guestId, guests.id))
      .where(
        and(
          eq(rsvpResponses.eventId, eventId),
          eq(rsvpResponses.attendanceStatus, 'not_attending'),
        ),
      ),
  ]);

  const total = totalResult[0]?.count ?? 0;
  const attending = attendingResult[0]?.count ?? 0;
  const notAttending = notAttendingResult[0]?.count ?? 0;
  const noResponse = total - attending - notAttending;

  return { attending, notAttending, noResponse, total };
}
