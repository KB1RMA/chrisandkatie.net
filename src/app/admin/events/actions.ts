'use server';

/**
 * Server actions for event CRUD operations.
 *
 * All actions require admin authentication and return a structured result.
 */
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';
import { auth, getAuthIdentity } from '@/lib/auth';
import { eventFormSchema } from '@/lib/schemas/event';
import type { EventFormData } from '@/lib/schemas/event';
import { geocodeLocation } from '@/lib/geocoding';
import * as EventRepository from '@/lib/db/repositories/events';
import * as RsvpRepository from '@/lib/db/repositories/rsvpResponses';

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

/**
 * Create a new wedding event.
 *
 * @param input - Event data matching eventFormSchema fields.
 * @returns Success with the new event id, or failure with an error message.
 */
export async function createEvent(
  input: Partial<EventFormData>,
): Promise<ActionResult<{ id: string }>> {
  const identity = getAuthIdentity(await auth());

  if (!identity || identity.type !== 'admin') {
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
  const id = randomUUID();
  const now = new Date().toISOString();

  // Geocode the location so coordinates are stored and ready for the map
  const coords = data.location ? await geocodeLocation(data.location) : null;

  try {
    await EventRepository.insertEvent({
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
      locationLat: coords?.lat ?? null,
      locationLng: coords?.lng ?? null,
      sortOrder: data.sortOrder,
      rsvpRequired: data.rsvpRequired,
      createdAt: now,
      updatedAt: now,
    });

    if (data.inviteAllGuests) {
      await EventRepository.addAllGuestsToEvent(id);
    }
  } catch (error) {
    console.error('Failed to create event:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create event',
    };
  }

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
  const identity = getAuthIdentity(await auth());

  if (!identity || identity.type !== 'admin') {
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

  // Re-geocode whenever the event is updated in case the location changed
  const coords = data.location ? await geocodeLocation(data.location) : null;

  try {
    await EventRepository.updateEventById(id, {
      name: data.name,
      description: data.description,
      location: data.location,
      eventDate: data.eventDate,
      startTime: data.startTime,
      endTime: data.endTime,
      type: data.type,
      dressCode: data.dressCode,
      parkingInfo: data.parkingInfo,
      locationLat: coords?.lat ?? null,
      locationLng: coords?.lng ?? null,
      sortOrder: data.sortOrder,
      rsvpRequired: data.rsvpRequired,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to update event:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update event',
    };
  }

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
  const identity = getAuthIdentity(await auth());

  if (!identity || identity.type !== 'admin') {
    return { success: false, error: 'Unauthorized' };
  }

  await EventRepository.deleteEventById(id);

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
  const identity = getAuthIdentity(await auth());

  if (!identity || identity.type !== 'admin') {
    return { success: false, error: 'Unauthorized' };
  }

  const summary = await RsvpRepository.getRsvpSummaryForEvent(eventId);

  return { success: true, data: summary };
}
