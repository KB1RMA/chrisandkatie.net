'use server';

import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import {
  guests,
  events,
  guestEvents,
  rsvpResponses,
  attendees,
} from '@/lib/db/schema';

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Verifies the current session has the admin role.
 * Throws 'Unauthorized' if the session is absent or lacks admin.
 */
async function requireAdmin(): Promise<void> {
  const session = await auth();

  if (!(session?.user?.roles ?? []).includes('admin')) {
    throw new Error('Unauthorized');
  }
}

/**
 * Updates a guest's attendance status for a specific event.
 * Creates a new RsvpResponse row if one does not yet exist.
 *
 * @param input - guestId, eventId, and the new attendanceStatus.
 * @returns { success: true } on success, or { success: false; error } if invalid.
 * @throws {Error} 'Unauthorized' when session lacks admin role.
 */
export async function updateRsvpAttendance(input: {
  guestId: string;
  eventId: string;
  attendanceStatus: 'attending' | 'not_attending';
}): Promise<ActionResult> {
  await requireAdmin();

  const db = getDb();

  // Validate guest exists
  const guest = await db.query.guests.findFirst({
    where: eq(guests.id, input.guestId),
  });

  if (!guest) {
    return { success: false, error: 'Guest not found.' };
  }

  // Validate event exists
  const event = await db.query.events.findFirst({
    where: eq(events.id, input.eventId),
  });

  if (!event) {
    return { success: false, error: 'Event not found.' };
  }

  // Validate guest is invited to this event
  const guestEvent = await db.query.guestEvents.findFirst({
    where: and(
      eq(guestEvents.guestId, input.guestId),
      eq(guestEvents.eventId, input.eventId),
    ),
  });

  if (!guestEvent) {
    return { success: false, error: 'Guest is not invited to this event.' };
  }

  const now = new Date().toISOString();

  // Upsert: update existing row or create a new one
  const existing = await db.query.rsvpResponses.findFirst({
    where: and(
      eq(rsvpResponses.guestId, input.guestId),
      eq(rsvpResponses.eventId, input.eventId),
    ),
  });

  if (existing) {
    await db
      .update(rsvpResponses)
      .set({ attendanceStatus: input.attendanceStatus, updatedAt: now })
      .where(eq(rsvpResponses.id, existing.id));
  } else {
    await db.insert(rsvpResponses).values({
      id: crypto.randomUUID(),
      guestId: input.guestId,
      eventId: input.eventId,
      attendanceStatus: input.attendanceStatus,
      numberOfAttending: 0,
      submittedAt: now,
      updatedAt: now,
    });
  }

  revalidatePath('/admin/rsvp');

  return { success: true };
}

/**
 * Sets a guest's wedding RSVP to "not attending" and optionally cascades
 * the change to all per-event RSVP responses in a single transaction.
 *
 * @param input - guestId and whether to cascade to all event responses.
 * @returns { success: true } on success, or { success: false; error } if invalid.
 * @throws {Error} 'Unauthorized' when session lacks admin role.
 */
export async function cascadeRsvpNotAttending(input: {
  guestId: string;
  cascadeToEvents: boolean;
}): Promise<ActionResult> {
  await requireAdmin();

  const db = getDb();

  // Validate guest exists
  const guest = await db.query.guests.findFirst({
    where: eq(guests.id, input.guestId),
  });

  if (!guest) {
    return { success: false, error: 'Guest not found.' };
  }

  const now = new Date().toISOString();

  if (input.cascadeToEvents) {
    // Update all rsvpResponses for this guest in one statement
    await db
      .update(rsvpResponses)
      .set({ attendanceStatus: 'not_attending', updatedAt: now })
      .where(eq(rsvpResponses.guestId, input.guestId));
  } else {
    // Find the main wedding event and update only that response
    const mainEvent = await db.query.events.findFirst({
      where: eq(events.type, 'main'),
    });

    if (mainEvent) {
      await db
        .update(rsvpResponses)
        .set({ attendanceStatus: 'not_attending', updatedAt: now })
        .where(
          and(
            eq(rsvpResponses.guestId, input.guestId),
            eq(rsvpResponses.eventId, mainEvent.id),
          ),
        );
    }
  }

  revalidatePath('/admin/rsvp');

  return { success: true };
}

/**
 * Updates the attendee details (meal choices, dietary restrictions) for an
 * existing RSVP response by deleting existing attendees and reinserting.
 *
 * @param input - rsvpResponseId and the complete new list of attendees.
 * @returns { success: true } on success, or { success: false; error } if invalid.
 * @throws {Error} 'Unauthorized' when session lacks admin role.
 */
export async function updateAttendeeDetails(input: {
  rsvpResponseId: string;
  attendees: Array<{
    name: string;
    mealOption: 'option_a' | 'option_b';
    dietaryRestrictions?: string;
  }>;
}): Promise<ActionResult> {
  await requireAdmin();

  const db = getDb();

  // Validate rsvpResponse exists
  const rsvpResponse = await db.query.rsvpResponses.findFirst({
    where: eq(rsvpResponses.id, input.rsvpResponseId),
  });

  if (!rsvpResponse) {
    return { success: false, error: 'RSVP response not found.' };
  }

  const now = new Date().toISOString();

  // Delete all existing attendees for this response
  await db
    .delete(attendees)
    .where(eq(attendees.rsvpResponseId, input.rsvpResponseId));

  // Reinsert the provided list
  if (input.attendees.length > 0) {
    await db.insert(attendees).values(
      input.attendees.map((attendee, index) => ({
        id: crypto.randomUUID(),
        rsvpResponseId: input.rsvpResponseId,
        name: attendee.name,
        mealOption: attendee.mealOption,
        dietaryRestrictions: attendee.dietaryRestrictions ?? null,
        sortOrder: index,
      })),
    );
  }

  // Bump updatedAt on the parent rsvpResponse
  await db
    .update(rsvpResponses)
    .set({ updatedAt: now })
    .where(eq(rsvpResponses.id, input.rsvpResponseId));

  revalidatePath('/admin/rsvp');

  return { success: true };
}
