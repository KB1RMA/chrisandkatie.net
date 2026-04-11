/**
 * Event repository — all database operations for the Event entity.
 *
 * This module owns query logic for events. Server Actions and other callers
 * should use these functions instead of calling the Drizzle client directly.
 */

import { asc, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { getDb } from '@/lib/db';
import { events, guestEvents, guests } from '@/lib/db/schema';

/**
 * Find all events an invitation's guests have access to, via the GuestEvent
 * junction table. Ordered by sortOrder ascending.
 *
 * @param invitationId - The invitation id to look up events for.
 * @returns An array of event rows the invitation's guests are linked to.
 */
export async function findEventsByInvitationId(invitationId: string) {
  const rows = await getDb()
    .selectDistinct({ event: events })
    .from(guestEvents)
    .innerJoin(events, eq(guestEvents.eventId, events.id))
    .innerJoin(guests, eq(guestEvents.guestId, guests.id))
    .where(eq(guests.invitationId, invitationId))
    .orderBy(asc(events.sortOrder));

  return rows.map((row) => row.event);
}

/**
 * Find all events ordered by sortOrder ascending.
 *
 * @returns An array of all event rows.
 */
export async function findAllEvents() {
  return getDb().select().from(events).orderBy(asc(events.sortOrder));
}

/**
 * Find a single event by its primary key.
 *
 * @param id - The event id to look up.
 * @returns The event row, or undefined if not found.
 */
export async function findEventById(id: string) {
  return getDb().query.events.findFirst({
    where: eq(events.id, id),
  });
}

/**
 * Find the single event with type 'main'.
 *
 * @returns The main event row, or undefined if none exists.
 */
export async function findMainEvent() {
  return getDb().query.events.findFirst({
    where: eq(events.type, 'main'),
  });
}

// D1's SQLite enforces ~100 statements per batch call. We flush in chunks of
// 100 to stay within the limit when bulk-adding guests to an event.
const D1_BATCH_STATEMENT_LIMIT = 100;

export type CreateEventValues = typeof events.$inferInsert;
export type UpdateEventValues = Partial<typeof events.$inferInsert>;

/**
 * Insert a new event record into the database.
 *
 * @param values - Column values for the new event row.
 */
export async function insertEvent(values: CreateEventValues): Promise<void> {
  await getDb().insert(events).values(values);
}

/**
 * Update an existing event record by id.
 *
 * @param id - The id of the event to update.
 * @param values - Partial column values to merge onto the existing row.
 */
export async function updateEventById(
  id: string,
  values: UpdateEventValues,
): Promise<void> {
  await getDb().update(events).set(values).where(eq(events.id, id));
}

/**
 * Delete an event record by id.
 *
 * @param id - The id of the event to delete.
 */
export async function deleteEventById(id: string): Promise<void> {
  await getDb().delete(events).where(eq(events.id, id));
}

/**
 * Link every guest in the database to the given event.
 *
 * Inserts one GuestEvent row per guest using batched statements to respect
 * D1's per-batch statement limit.
 *
 * @param eventId - The id of the event to add all guests to.
 */
export async function addAllGuestsToEvent(eventId: string): Promise<void> {
  const db = getDb();

  const allGuests = await db.query.guests.findMany({
    columns: { id: true },
  });

  // Build one INSERT statement per guest row (3 bound variables each —
  // safely under D1's per-statement variable limit).
  const statements = allGuests.map((guest) =>
    db.insert(guestEvents).values({
      id: randomUUID(),
      guestId: guest.id,
      eventId,
    }),
  );

  for (let i = 0; i < statements.length; i += D1_BATCH_STATEMENT_LIMIT) {
    const [first, ...rest] = statements.slice(i, i + D1_BATCH_STATEMENT_LIMIT);

    await db.batch([first, ...rest]);
  }
}
