'use server';

import { revalidatePath } from 'next/cache';
import { auth, getAuthIdentity } from '@/lib/auth';
import * as EventRepository from '@/lib/db/repositories/events';
import * as GuestRepository from '@/lib/db/repositories/guests';
import * as SeatingRepository from '@/lib/db/repositories/seating';
import {
  addTableSchema,
  assignGuestSchema,
  deleteTableSchema,
  generateTablesSchema,
  unassignGuestSchema,
  updateTableSchema,
} from '@/lib/schemas/seating';

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Ensure the current session belongs to an admin.
 *
 * @throws {Error} 'Unauthorized' when session lacks admin role.
 */
async function requireAdmin(): Promise<void> {
  const identity = getAuthIdentity(await auth());

  if (!identity || identity.type !== 'admin') {
    throw new Error('Unauthorized');
  }
}

/**
 * Extract the first validation issue message from a failed Zod parse.
 *
 * @param error - The ZodError from a failed safeParse.
 * @returns The first issue message, or a generic fallback.
 */
function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? 'Invalid input';
}

/** Error returned when no main event exists to attach the chart to. */
const NO_MAIN_EVENT_ERROR =
  'No main event found. Create the main event before building a seating chart.';

/**
 * Generate the initial set of seating tables: an optional head table
 * followed by numbered round tables. Only allowed when no tables exist yet.
 *
 * @param input - Total table count, seats per table, and head table options.
 * @returns { success: true } on success, or { success: false; error } if invalid.
 * @throws {Error} 'Unauthorized' when session lacks admin role.
 */
export async function generateSeatingTables(input: {
  tableCount: number;
  seatsPerTable: number;
  includeHeadTable: boolean;
  headTableSeats: number;
}): Promise<ActionResult> {
  await requireAdmin();

  const parsed = generateTablesSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: firstIssue(parsed.error) };
  }

  const mainEvent = await EventRepository.findMainEvent();

  if (!mainEvent) {
    return { success: false, error: NO_MAIN_EVENT_ERROR };
  }

  const data = parsed.data;
  const existing = await SeatingRepository.findAllSeatingTables(mainEvent.id);

  if (existing.length > 0) {
    return {
      success: false,
      error: 'Tables already exist. Add or remove tables individually.',
    };
  }

  const guestTableCount = data.includeHeadTable
    ? data.tableCount - 1
    : data.tableCount;

  const headTableRows = data.includeHeadTable
    ? [
        {
          id: crypto.randomUUID(),
          eventId: mainEvent.id,
          name: 'Head Table',
          capacity: data.headTableSeats,
          isHeadTable: true,
          sortOrder: 0,
        },
      ]
    : [];

  const guestTableRows = Array.from({ length: guestTableCount }, (_, i) => ({
    id: crypto.randomUUID(),
    eventId: mainEvent.id,
    name: `Table ${i + 1}`,
    capacity: data.seatsPerTable,
    isHeadTable: false,
    sortOrder: i + 1,
  }));

  await SeatingRepository.insertSeatingTables([
    ...headTableRows,
    ...guestTableRows,
  ]);

  revalidatePath('/admin/seating');

  return { success: true };
}

/**
 * Add a single seating table after the current last table.
 *
 * @param input - Table name and seat capacity.
 * @returns { success: true } on success, or { success: false; error } if invalid.
 * @throws {Error} 'Unauthorized' when session lacks admin role.
 */
export async function addSeatingTable(input: {
  name: string;
  capacity: number;
}): Promise<ActionResult> {
  await requireAdmin();

  const parsed = addTableSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: firstIssue(parsed.error) };
  }

  const mainEvent = await EventRepository.findMainEvent();

  if (!mainEvent) {
    return { success: false, error: NO_MAIN_EVENT_ERROR };
  }

  const existing = await SeatingRepository.findAllSeatingTables(mainEvent.id);
  const nextSortOrder =
    existing.length > 0
      ? Math.max(...existing.map((table) => table.sortOrder)) + 1
      : 0;

  await SeatingRepository.insertSeatingTables([
    {
      id: crypto.randomUUID(),
      eventId: mainEvent.id,
      name: parsed.data.name,
      capacity: parsed.data.capacity,
      isHeadTable: false,
      sortOrder: nextSortOrder,
    },
  ]);

  revalidatePath('/admin/seating');

  return { success: true };
}

/**
 * Rename a seating table or change its capacity. Capacity may not drop
 * below the number of guests already seated.
 *
 * @param input - Table id plus the new name and capacity.
 * @returns { success: true } on success, or { success: false; error } if invalid.
 * @throws {Error} 'Unauthorized' when session lacks admin role.
 */
export async function updateSeatingTableDetails(input: {
  id: string;
  name: string;
  capacity: number;
}): Promise<ActionResult> {
  await requireAdmin();

  const parsed = updateTableSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: firstIssue(parsed.error) };
  }

  const table = await SeatingRepository.findSeatingTableById(parsed.data.id);

  if (!table) {
    return { success: false, error: 'Table not found.' };
  }

  const seated = await SeatingRepository.countAssignmentsForTable(
    parsed.data.id,
  );

  if (parsed.data.capacity < seated) {
    return {
      success: false,
      error: `Capacity cannot be below the ${seated} guests already seated.`,
    };
  }

  await SeatingRepository.updateSeatingTable(parsed.data.id, {
    name: parsed.data.name,
    capacity: parsed.data.capacity,
  });

  revalidatePath('/admin/seating');

  return { success: true };
}

/**
 * Delete a seating table. Guests seated at it become unassigned.
 *
 * @param input - The table id to delete.
 * @returns { success: true } on success, or { success: false; error } if invalid.
 * @throws {Error} 'Unauthorized' when session lacks admin role.
 */
export async function deleteSeatingTable(input: {
  id: string;
}): Promise<ActionResult> {
  await requireAdmin();

  const parsed = deleteTableSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: firstIssue(parsed.error) };
  }

  const table = await SeatingRepository.findSeatingTableById(parsed.data.id);

  if (!table) {
    return { success: false, error: 'Table not found.' };
  }

  await SeatingRepository.deleteSeatingTable(parsed.data.id);

  revalidatePath('/admin/seating');

  return { success: true };
}

/**
 * Seat a guest at a table, moving them from any previous table. Fails when
 * the target table is already at capacity.
 *
 * @param input - The guest and target table ids.
 * @returns { success: true } on success, or { success: false; error } if invalid.
 * @throws {Error} 'Unauthorized' when session lacks admin role.
 */
export async function assignGuestToTable(input: {
  guestId: string;
  tableId: string;
}): Promise<ActionResult> {
  await requireAdmin();

  const parsed = assignGuestSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: firstIssue(parsed.error) };
  }

  const guest = await GuestRepository.findGuestById(parsed.data.guestId);

  if (!guest) {
    return { success: false, error: 'Guest not found.' };
  }

  const table = await SeatingRepository.findSeatingTableById(
    parsed.data.tableId,
  );

  if (!table) {
    return { success: false, error: 'Table not found.' };
  }

  const existing = await SeatingRepository.findAssignmentByGuestId(
    parsed.data.guestId,
  );

  if (existing?.tableId === parsed.data.tableId) {
    return { success: true };
  }

  const seated = await SeatingRepository.countAssignmentsForTable(
    parsed.data.tableId,
  );

  if (seated >= table.capacity) {
    return { success: false, error: `${table.name} is full.` };
  }

  await SeatingRepository.upsertAssignment(
    parsed.data.guestId,
    parsed.data.tableId,
  );

  revalidatePath('/admin/seating');

  return { success: true };
}

/**
 * Remove a guest's seat, returning them to the unassigned list.
 *
 * @param input - The guest id to unassign.
 * @returns { success: true } on success (idempotent), or a validation error.
 * @throws {Error} 'Unauthorized' when session lacks admin role.
 */
export async function unassignGuest(input: {
  guestId: string;
}): Promise<ActionResult> {
  await requireAdmin();

  const parsed = unassignGuestSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: firstIssue(parsed.error) };
  }

  await SeatingRepository.deleteAssignmentForGuest(parsed.data.guestId);

  revalidatePath('/admin/seating');

  return { success: true };
}
