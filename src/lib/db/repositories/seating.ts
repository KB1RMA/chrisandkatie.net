/**
 * Seating repository — all database operations for the SeatingTable and
 * SeatingAssignment tables.
 *
 * This module owns query logic for the reception seating chart. Server
 * Actions and other callers should use these functions instead of calling
 * the Drizzle client directly.
 */

import { asc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import {
  guests,
  invitations,
  seatingAssignments,
  seatingTables,
} from '@/lib/db/schema';

export type InsertSeatingTableValues = typeof seatingTables.$inferInsert;
export type UpdateSeatingTableValues = Partial<
  Pick<typeof seatingTables.$inferInsert, 'name' | 'capacity' | 'sortOrder'>
>;

/**
 * Fetch an event's seating tables ordered by sortOrder, with their
 * assignments (ordered by seatOrder) eagerly loaded.
 *
 * @param eventId - The event whose seating chart to load.
 * @returns SeatingTable rows with nested assignment arrays.
 */
export async function findAllSeatingTables(eventId: string) {
  return getDb().query.seatingTables.findMany({
    where: eq(seatingTables.eventId, eventId),
    orderBy: asc(seatingTables.sortOrder),
    with: {
      assignments: {
        orderBy: asc(seatingAssignments.seatOrder),
      },
    },
  });
}

/**
 * Fetch a single seating table by id.
 *
 * @param id - The seating table id to look up.
 * @returns The SeatingTable row, or undefined when not found.
 */
export async function findSeatingTableById(id: string) {
  return getDb().query.seatingTables.findFirst({
    where: eq(seatingTables.id, id),
  });
}

/**
 * Count the assignments currently occupying a seating table.
 *
 * @param tableId - The seating table id to count seats for.
 * @returns The number of guests assigned to the table.
 */
export async function countAssignmentsForTable(
  tableId: string,
): Promise<number> {
  const rows = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(seatingAssignments)
    .where(eq(seatingAssignments.tableId, tableId));

  return rows[0]?.count ?? 0;
}

/**
 * Insert multiple seating tables in a single statement.
 *
 * @param values - Array of rows to insert. No-ops when the array is empty.
 */
export async function insertSeatingTables(
  values: InsertSeatingTableValues[],
): Promise<void> {
  if (values.length === 0) {
    return;
  }

  await getDb().insert(seatingTables).values(values);
}

/**
 * Update name, capacity, or sortOrder on a seating table and bump its
 * updatedAt timestamp.
 *
 * @param id - The seating table id to update.
 * @param values - Partial column values to write.
 */
export async function updateSeatingTable(
  id: string,
  values: UpdateSeatingTableValues,
): Promise<void> {
  await getDb()
    .update(seatingTables)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(eq(seatingTables.id, id));
}

/**
 * Delete a seating table. Assignments cascade via the foreign key.
 *
 * @param id - The seating table id to delete.
 */
export async function deleteSeatingTable(id: string): Promise<void> {
  await getDb().delete(seatingTables).where(eq(seatingTables.id, id));
}

/**
 * Find the seating assignment for a guest, if one exists.
 *
 * @param guestId - The guest id to look up.
 * @returns The SeatingAssignment row, or undefined when unassigned.
 */
export async function findAssignmentByGuestId(guestId: string) {
  return getDb().query.seatingAssignments.findFirst({
    where: eq(seatingAssignments.guestId, guestId),
  });
}

/**
 * Assign a guest to a seating table, moving them if already seated
 * elsewhere. The guest takes the next seatOrder slot at the target table.
 *
 * @param guestId - The guest to seat.
 * @param tableId - The seating table to place the guest at.
 */
export async function upsertAssignment(
  guestId: string,
  tableId: string,
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({
      maxOrder: sql<number | null>`max(${seatingAssignments.seatOrder})`,
    })
    .from(seatingAssignments)
    .where(eq(seatingAssignments.tableId, tableId));
  const nextOrder = (rows[0]?.maxOrder ?? -1) + 1;

  await db
    .insert(seatingAssignments)
    .values({
      id: crypto.randomUUID(),
      guestId,
      tableId,
      seatOrder: nextOrder,
    })
    .onConflictDoUpdate({
      target: seatingAssignments.guestId,
      set: { tableId, seatOrder: nextOrder },
    });
}

/**
 * Remove a guest's seating assignment.
 *
 * @param guestId - The guest whose seat should be cleared.
 */
export async function deleteAssignmentForGuest(guestId: string): Promise<void> {
  await getDb()
    .delete(seatingAssignments)
    .where(eq(seatingAssignments.guestId, guestId));
}

/**
 * The flattened shape returned by `findSeatingAssignmentsForExport`.
 *
 * One row per assigned guest with their table, seat position, party name,
 * and meal details for the wedding coordinator.
 */
export type SeatingExportRow = {
  tableId: string;
  tableName: string;
  tableSortOrder: number;
  guestId: string;
  seatOrder: number;
  firstName: string;
  lastName: string;
  partyName: string | null;
  mealChoice: string | null;
  dietaryRestrictions: string | null;
};

/**
 * Return an event's seating assignments joined with guest and table details,
 * ordered by table then seat, suitable for the coordinator CSV export.
 *
 * Meal and dietary values come from the guest-level columns written by the
 * main RSVP wizard; callers should prefer per-event attendee data when
 * available and fall back to these.
 *
 * @param eventId - The event whose seating chart to export.
 * @returns One `SeatingExportRow` per assigned guest.
 */
export async function findSeatingAssignmentsForExport(
  eventId: string,
): Promise<SeatingExportRow[]> {
  return getDb()
    .select({
      tableId: seatingTables.id,
      tableName: seatingTables.name,
      tableSortOrder: seatingTables.sortOrder,
      guestId: guests.id,
      seatOrder: seatingAssignments.seatOrder,
      firstName: guests.firstName,
      lastName: guests.lastName,
      partyName: invitations.mailingAddress,
      mealChoice: guests.mealChoice,
      dietaryRestrictions: guests.dietaryRestrictions,
    })
    .from(seatingAssignments)
    .innerJoin(seatingTables, eq(seatingAssignments.tableId, seatingTables.id))
    .innerJoin(guests, eq(seatingAssignments.guestId, guests.id))
    .leftJoin(invitations, eq(guests.invitationId, invitations.id))
    .where(eq(seatingTables.eventId, eventId))
    .orderBy(asc(seatingTables.sortOrder), asc(seatingAssignments.seatOrder));
}
