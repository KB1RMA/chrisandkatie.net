/**
 * Attendee repository — all database operations for the Attendee entity.
 *
 * This module owns query logic for attendees. Server Actions and other callers
 * should use these functions instead of calling the Drizzle client directly.
 */

import { asc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { attendees } from '@/lib/db/schema';

export type InsertAttendeeValues = typeof attendees.$inferInsert;

/**
 * Fetch all attendees belonging to an RSVP response, ordered by sortOrder.
 *
 * @param rsvpResponseId - The RSVP response to fetch attendees for.
 * @returns Attendee rows in ascending sort order.
 */
export async function findAttendeesByRsvpResponseId(rsvpResponseId: string) {
  return getDb().query.attendees.findMany({
    where: eq(attendees.rsvpResponseId, rsvpResponseId),
    orderBy: asc(attendees.sortOrder),
  });
}

/**
 * Fetch all attendees belonging to any of the given RSVP responses.
 *
 * Used to reconstruct per-person attendance from data as it is stored, where
 * attending people are recorded as attendee name rows under a party's response.
 *
 * @param rsvpResponseIds - The RSVP response ids to fetch attendees for.
 * @returns Attendee rows for the given responses, ordered by sortOrder.
 */
export async function findAttendeesByResponseIds(rsvpResponseIds: string[]) {
  if (rsvpResponseIds.length === 0) {
    return [];
  }

  return getDb().query.attendees.findMany({
    where: inArray(attendees.rsvpResponseId, rsvpResponseIds),
    orderBy: asc(attendees.sortOrder),
  });
}

/**
 * Delete all attendees for an RSVP response then insert a fresh list.
 *
 * This replace pattern is used when an RSVP is updated — simpler than
 * diffing individual rows since attendee lists are small.
 *
 * @param rsvpResponseId - The RSVP response whose attendees are replaced.
 * @param newAttendees - The complete new list of attendees to insert.
 */
export async function replaceAttendees(
  rsvpResponseId: string,
  newAttendees: InsertAttendeeValues[],
): Promise<void> {
  const db = getDb();

  await db
    .delete(attendees)
    .where(eq(attendees.rsvpResponseId, rsvpResponseId));

  if (newAttendees.length > 0) {
    await db.insert(attendees).values(newAttendees);
  }
}
