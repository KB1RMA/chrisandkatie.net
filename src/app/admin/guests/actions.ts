'use server';

import { revalidatePath } from 'next/cache';
import { auth, getAuthIdentity } from '@/lib/auth';
import * as GuestRepository from '@/lib/db/repositories/guests';
import * as EventRepository from '@/lib/db/repositories/events';
import * as GuestEventRepository from '@/lib/db/repositories/guestEvents';
import * as RsvpRepository from '@/lib/db/repositories/rsvpResponses';
import * as AttendeeRepository from '@/lib/db/repositories/attendees';

type ActionResult = { success: true } | { success: false; error: string };

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
  const identity = getAuthIdentity(await auth());

  if (!identity || identity.type !== 'admin') {
    throw new Error('Unauthorized');
  }

  // Validate guest exists
  const guest = await GuestRepository.findGuestById(input.guestId);

  if (!guest) {
    return { success: false, error: 'Guest not found.' };
  }

  // Validate event exists
  const event = await EventRepository.findEventById(input.eventId);

  if (!event) {
    return { success: false, error: 'Event not found.' };
  }

  // Validate guest is invited to this event
  const guestEvent = await GuestEventRepository.findGuestEventByGuestAndEvent(
    input.guestId,
    input.eventId,
  );

  if (!guestEvent) {
    return { success: false, error: 'Guest is not invited to this event.' };
  }

  const now = new Date().toISOString();

  // Upsert: update existing row or create a new one
  const existing = await RsvpRepository.findRsvpByGuestAndEvent(
    input.guestId,
    input.eventId,
  );

  if (existing) {
    await RsvpRepository.updateRsvpAttendanceStatus(
      existing.id,
      input.attendanceStatus,
      now,
    );
  } else {
    await RsvpRepository.insertRsvpResponse({
      id: crypto.randomUUID(),
      guestId: input.guestId,
      eventId: input.eventId,
      attendanceStatus: input.attendanceStatus,
      numberOfAttending: 0,
      submittedAt: now,
      updatedAt: now,
    });
  }

  revalidatePath('/admin/guests');
  revalidatePath('/admin/events');

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
  const identity = getAuthIdentity(await auth());

  if (!identity || identity.type !== 'admin') {
    throw new Error('Unauthorized');
  }

  // Validate guest exists
  const guest = await GuestRepository.findGuestById(input.guestId);

  if (!guest) {
    return { success: false, error: 'Guest not found.' };
  }

  const now = new Date().toISOString();

  if (input.cascadeToEvents) {
    // Update all rsvpResponses for this guest in one statement
    await RsvpRepository.updateAllRsvpsNotAttendingForGuest(input.guestId, now);
  } else {
    // Find the main wedding event and update only that response
    const mainEvent = await EventRepository.findMainEvent();

    if (mainEvent) {
      await RsvpRepository.updateRsvpNotAttendingForGuestAndEvent(
        input.guestId,
        mainEvent.id,
        now,
      );
    }
  }

  revalidatePath('/admin/guests');
  revalidatePath('/admin/events');

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
    mealOption: 'option_a' | 'option_b' | null;
    dietaryRestrictions?: string;
  }>;
}): Promise<ActionResult> {
  const identity = getAuthIdentity(await auth());

  if (!identity || identity.type !== 'admin') {
    throw new Error('Unauthorized');
  }

  // Validate rsvpResponse exists
  const rsvpResponse = await RsvpRepository.findRsvpById(input.rsvpResponseId);

  if (!rsvpResponse) {
    return { success: false, error: 'RSVP response not found.' };
  }

  const now = new Date().toISOString();

  // Replace attendees and bump the parent response timestamp
  await AttendeeRepository.replaceAttendees(
    input.rsvpResponseId,
    input.attendees.map((attendee, index) => ({
      id: crypto.randomUUID(),
      rsvpResponseId: input.rsvpResponseId,
      name: attendee.name,
      mealOption: attendee.mealOption,
      dietaryRestrictions: attendee.dietaryRestrictions ?? null,
      sortOrder: index,
    })),
  );

  await RsvpRepository.updateRsvpTimestamp(input.rsvpResponseId, now);

  revalidatePath('/admin/guests');
  revalidatePath('/admin/events');

  return { success: true };
}
