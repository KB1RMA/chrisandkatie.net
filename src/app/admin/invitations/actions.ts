'use server';

import { eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth, getAuthIdentity } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { guestEvents, invitations } from '@/lib/db/schema';
import { generateUniqueInvitationCode } from '@/lib/invitation-code';

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
  const identity = getAuthIdentity(await auth());

  if (!identity || identity.type !== 'admin') {
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
 * Bulk generate invitation codes for all invitations that are missing one.
 *
 * Iterates all invitations where `invitationCode IS NULL` and assigns a newly
 * generated unique code to each. Uses `generateUniqueInvitationCode` which
 * checks the database for collisions and retries up to MAX_ATTEMPTS times.
 *
 * @returns Count of invitations updated, or an error message.
 * @throws Error if not authenticated as admin.
 */
export async function backfillInvitationCodes(): Promise<{
  success: boolean;
  updatedCount?: number;
  error?: string;
}> {
  const identity = getAuthIdentity(await auth());

  if (!identity || identity.type !== 'admin') {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const db = getDb();
    const now = new Date().toISOString();

    // Load all invitations that still need a code
    const pending = await db.query.invitations.findMany({
      where: isNull(invitations.invitationCode),
      columns: { id: true, invitationCode: true },
    });

    if (pending.length === 0) {
      return { success: true, updatedCount: 0 };
    }

    let updatedCount = 0;

    for (const invitation of pending) {
      const code = await generateUniqueInvitationCode(db);

      await db
        .update(invitations)
        .set({ invitationCode: code, updatedAt: now })
        .where(eq(invitations.id, invitation.id));

      updatedCount += 1;
    }

    revalidatePath('/admin/invitations');

    return { success: true, updatedCount };
  } catch (error) {
    console.error('Failed to backfill invitation codes:', error);

    return { success: false, error: 'Failed to backfill invitation codes' };
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
  const identity = getAuthIdentity(await auth());

  if (!identity || identity.type !== 'admin') {
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
