'use server';

/**
 * Server actions for event CRUD operations.
 *
 * All actions require admin authentication and return a structured result.
 */
import { eq, and, count } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { events, guestEvents, rsvpResponses } from '@/lib/db/schema';
import { eventFormSchema } from '@/lib/schemas/event';
import type { EventFormData } from '@/lib/schemas/event';

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

/**
 * Check that the current session belongs to an admin user.
 *
 * @returns The session if admin, or null if unauthorized.
 */
async function requireAdmin(): Promise<boolean> {
  const session = await auth();

  return (session?.user?.roles ?? []).includes('admin');
}

/**
 * Create a new wedding event.
 *
 * @param input - Event data matching eventFormSchema fields.
 * @returns Success with the new event id, or failure with an error message.
 */
export async function createEvent(
  input: Partial<EventFormData>,
): Promise<ActionResult<{ id: string }>> {
  const isAdmin = await requireAdmin();

  if (!isAdmin) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = eventFormSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  const data = parsed.data;
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();

  const eventValues = {
    id,
    name: data.name,
    description: data.description,
    location: data.location,
    eventDate: data.eventDate,
    startTime: data.startTime,
    endTime: data.endTime,
    type: data.type,
    dressCode: data.dressCode,
    parkingInfo: data.parkingInfo,
    sortOrder: data.sortOrder,
    createdAt: now,
    updatedAt: now,
  };

  if (!data.inviteAllGuests) {
    await db.insert(events).values(eventValues);

    revalidatePath('/admin/events');
    revalidatePath('/schedule');

    return { success: true, data: { id } };
  }

  // Wrap event creation and guest invitations in a single transaction so a
  // failed guestEvents insert cannot leave a partially-applied state.
  await db.transaction(async (tx) => {
    await tx.insert(events).values(eventValues);

    const allGuests = await tx.query.guests.findMany({
      columns: { id: true },
    });

    if (allGuests.length > 0) {
      await tx.insert(guestEvents).values(
        allGuests.map((guest) => ({
          id: randomUUID(),
          guestId: guest.id,
          eventId: id,
        })),
      );
    }
  });

  revalidatePath('/admin/events');
  revalidatePath('/schedule');

  return { success: true, data: { id } };
}

/**
 * Update an existing wedding event.
 *
 * @param input - Event data including the id of the record to update.
 * @returns Success, or failure with an error message.
 */
export async function updateEvent(
  input: Partial<EventFormData> & { id: string },
): Promise<ActionResult> {
  const isAdmin = await requireAdmin();

  if (!isAdmin) {
    return { success: false, error: 'Unauthorized' };
  }

  const { id, ...rest } = input;
  const parsed = eventFormSchema.safeParse(rest);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  const data = parsed.data;
  const db = getDb();

  await db
    .update(events)
    .set({
      name: data.name,
      description: data.description,
      location: data.location,
      eventDate: data.eventDate,
      startTime: data.startTime,
      endTime: data.endTime,
      type: data.type,
      dressCode: data.dressCode,
      parkingInfo: data.parkingInfo,
      sortOrder: data.sortOrder,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(events.id, id));

  revalidatePath('/admin/events');
  revalidatePath('/schedule');

  return { success: true };
}

/**
 * Delete a wedding event and all associated RSVP data.
 *
 * Cascade deletion is handled by the database foreign key constraint.
 *
 * @param param0 - Object containing the event id to delete.
 * @returns Success, or failure with an error message.
 */
export async function deleteEvent({
  id,
}: {
  id: string;
}): Promise<ActionResult> {
  const isAdmin = await requireAdmin();

  if (!isAdmin) {
    return { success: false, error: 'Unauthorized' };
  }

  const db = getDb();

  await db.delete(events).where(eq(events.id, id));

  revalidatePath('/admin/events');
  revalidatePath('/schedule');

  return { success: true };
}

/**
 * Get aggregated RSVP counts for a specific event.
 *
 * Queries total invited guest count, attending count, and not_attending count.
 * Derives noResponse from total minus the two known statuses.
 *
 * @param param0 - Object containing the eventId to summarize.
 * @returns Success with attending/notAttending/noResponse/total counts.
 */
export async function getEventRsvpSummary({
  eventId,
}: {
  eventId: string;
}): Promise<
  ActionResult<{
    attending: number;
    notAttending: number;
    noResponse: number;
    total: number;
  }>
> {
  const isAdmin = await requireAdmin();

  if (!isAdmin) {
    return { success: false, error: 'Unauthorized' };
  }

  const db = getDb();

  const [totalResult, attendingResult, notAttendingResult] = await Promise.all([
    db
      .select({ count: count() })
      .from(guestEvents)
      .where(eq(guestEvents.eventId, eventId)),
    db
      .select({ count: count() })
      .from(rsvpResponses)
      .where(
        and(
          eq(rsvpResponses.eventId, eventId),
          eq(rsvpResponses.attendanceStatus, 'attending'),
        ),
      ),
    db
      .select({ count: count() })
      .from(rsvpResponses)
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

  return {
    success: true,
    data: { attending, notAttending, noResponse, total },
  };
}
