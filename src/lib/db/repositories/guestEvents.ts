/**
 * GuestEvent repository — all database operations for the GuestEvent junction table.
 *
 * This module owns query logic for the many-to-many relationship between guests
 * and events. Server Actions and other callers should use these functions
 * instead of calling the Drizzle client directly.
 */

import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { guestEvents } from '@/lib/db/schema';

export type InsertGuestEventValues = typeof guestEvents.$inferInsert;

/**
 * Find the junction row linking a single guest to a single event.
 *
 * @param guestId - The guest id to look up.
 * @param eventId - The event id to look up.
 * @returns The GuestEvent row, or undefined if the guest is not invited.
 */
export async function findGuestEventByGuestAndEvent(
  guestId: string,
  eventId: string,
) {
  return getDb().query.guestEvents.findFirst({
    where: and(
      eq(guestEvents.guestId, guestId),
      eq(guestEvents.eventId, eventId),
    ),
  });
}

/**
 * Fetch all GuestEvent rows for a specific event, with each guest record
 * eagerly loaded.
 *
 * @param eventId - The event id to fetch invitees for.
 * @returns GuestEvent rows with nested guest objects.
 */
export async function findGuestEventsForEvent(eventId: string) {
  return getDb().query.guestEvents.findMany({
    where: eq(guestEvents.eventId, eventId),
    with: { guest: true },
  });
}

/**
 * Fetch all GuestEvent rows for a list of guest ids, with each event record
 * eagerly loaded.
 *
 * @param guestIds - Guest ids to fetch event assignments for.
 * @returns GuestEvent rows with nested event objects.
 */
export async function findGuestEventsForGuestIds(guestIds: string[]) {
  return getDb().query.guestEvents.findMany({
    where: inArray(guestEvents.guestId, guestIds),
    with: { event: true },
  });
}

/**
 * Delete all GuestEvent rows for a specific guest.
 *
 * @param guestId - The guest whose event assignments should be removed.
 */
export async function deleteGuestEventsForGuest(
  guestId: string,
): Promise<void> {
  await getDb().delete(guestEvents).where(eq(guestEvents.guestId, guestId));
}

/**
 * Insert multiple GuestEvent rows in a single statement.
 *
 * @param values - Array of rows to insert. No-ops when the array is empty.
 */
export async function insertGuestEvents(
  values: InsertGuestEventValues[],
): Promise<void> {
  if (values.length === 0) {
    return;
  }

  await getDb().insert(guestEvents).values(values);
}
