'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { invitations } from '@/lib/db/schema';

/**
 * Update visible events for an invitation.
 *
 * @param invitationId - The ID of the invitation to update.
 * @param eventIds - Array of event IDs that should be visible to this invitation.
 * @returns Success status and optional error message.
 * @throws Error if not authenticated or update fails.
 */
export async function updateInvitationVisibleEvents(
  invitationId: string,
  eventIds: number[],
): Promise<{ success: boolean; error?: string }> {
  // Check authentication
  const session = await auth();

  if (!session?.user?.guestId) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const db = getDb();

    // Convert event IDs to JSON string
    const visibleEvents = JSON.stringify(eventIds.sort((a, b) => a - b));

    // Update invitation
    await db
      .update(invitations)
      .set({
        visibleEvents,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(invitations.id, invitationId));

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
