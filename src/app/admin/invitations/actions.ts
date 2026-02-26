'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { guestEvents } from '@/lib/db/schema';

/**
 * Update visible events for an invitation by syncing the guestEvents table.
 *
 * For each guest on the invitation, deletes all existing guestEvents rows then
 * inserts new rows for each granted eventId. An empty eventIds array removes
 * all event visibility for all guests on the invitation.
 *
 * @param invitationId - The ID of the invitation to update.
 * @param eventIds - UUID strings of events that should be visible (from events.id).
 * @returns Success status and optional error message.
 * @throws Error if not authenticated or update fails.
 */
export async function updateInvitationVisibleEvents(
  invitationId: string,
  eventIds: string[],
): Promise<{ success: boolean; error?: string }> {
  // Check authentication
  const session = await auth();

  if (!session?.user?.roles?.includes('admin')) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const db = getDb();

    // Fetch all guests for this invitation
    const invitation = await db.query.invitations.findFirst({
      where: (table, { eq }) => eq(table.id, invitationId),
      with: {
        guests: true,
      },
    });

    if (!invitation) {
      return { success: false, error: 'Invitation not found' };
    }

    // Deduplicate event IDs to avoid unique constraint violations
    const uniqueEventIds = [...new Set(eventIds)];

    // Sync guestEvents for each guest: delete existing rows, insert granted ones
    for (const guest of invitation.guests) {
      await db.delete(guestEvents).where(eq(guestEvents.guestId, guest.id));

      if (uniqueEventIds.length > 0) {
        await db.insert(guestEvents).values(
          uniqueEventIds.map((eventId) => ({
            id: crypto.randomUUID(),
            guestId: guest.id,
            eventId,
          })),
        );
      }
    }

    // Revalidate admin and schedule pages
    revalidatePath('/admin/invitations');
    revalidatePath('/schedule');

    return { success: true };
  } catch (error) {
    console.error('Failed to update visible events:', error);

    return {
      success: false,
      error: 'Failed to update visible events',
    };
  }
}

/**
 * Reset RSVP responses for all guests on an invitation.
 *
 * @param invitationId - The ID of the invitation to reset.
 * @returns Success status and optional error message.
 * @throws Error if not authenticated or reset fails.
 */
export async function resetInvitationRSVP(
  invitationId: string,
): Promise<{ success: boolean; error?: string }> {
  // Check authentication
  const session = await auth();

  if (!session?.user?.guestId) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const db = getDb();

    // Get all guests for this invitation
    const invitation = await db.query.invitations.findFirst({
      where: (table, { eq }) => eq(table.id, invitationId),
      with: {
        guests: true,
      },
    });

    if (!invitation) {
      return { success: false, error: 'Invitation not found' };
    }

    // Import guests table dynamically to avoid circular dependency
    const { guests } = await import('@/lib/db/schema');

    // Reset all guests' RSVP data
    const now = new Date().toISOString();

    for (const guest of invitation.guests) {
      await db
        .update(guests)
        .set({
          attending: null,
          mealChoice: null,
          dietaryRestrictions: null,
          notes: null,
          updatedAt: now,
        })
        .where(eq(guests.id, guest.id));
    }

    // Revalidate admin pages
    revalidatePath('/admin/invitations');
    revalidatePath('/admin/guests');
    revalidatePath('/rsvp');

    return { success: true };
  } catch (error) {
    console.error('Failed to reset RSVP:', error);

    return {
      success: false,
      error: 'Failed to reset RSVP',
    };
  }
}
