'use server';

/**
 * Server action to update RSVP responses.
 */
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { guests } from '@/lib/db/schema';
import { submitRsvpSchema, type SubmitRsvpInput } from '@/lib/schemas/rsvp';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

/**
 * Update RSVP responses for all guests on an invitation.
 *
 * @throws Error if user is not authenticated or not authorized
 */
export async function submitRsvp(input: SubmitRsvpInput) {
  try {
    // Check authentication
    const session = await auth();

    if (!session?.user?.guestId) {
      throw new Error('Unauthorized');
    }

    // Validate input
    const validatedData = submitRsvpSchema.parse(input);

    const db = getDb();

    // Verify logged-in guest belongs to this invitation
    const loggedInGuest = await db.query.guests.findFirst({
      where: (table, { eq }) => eq(table.id, session.user.guestId as string),
    });

    if (
      !loggedInGuest ||
      loggedInGuest.invitationId !== validatedData.invitationId
    ) {
      throw new Error('Not authorized for this invitation');
    }

    // Update each guest
    const now = new Date().toISOString();

    for (const guestUpdate of validatedData.guests) {
      // Verify guest belongs to this invitation
      const guest = await db.query.guests.findFirst({
        where: (table, { eq }) => eq(table.id, guestUpdate.id),
      });

      if (!guest || guest.invitationId !== validatedData.invitationId) {
        continue; // Skip guests not on this invitation
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: Record<string, any> = {
        attending: guestUpdate.attending,
        mealChoice: guestUpdate.mealChoice,
        notes: guestUpdate.notes,
        updatedAt: now,
      };

      // Update names for plus-ones (guests with firstName "guest")
      if (guest.firstName.toLowerCase() === 'guest') {
        if (guestUpdate.firstName) {
          updateData.firstName = guestUpdate.firstName;
        }

        if (guestUpdate.lastName) {
          updateData.lastName = guestUpdate.lastName;
        }
      }

      await db
        .update(guests)
        .set(updateData)
        .where(eq(guests.id, guestUpdate.id));
    }

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error('Invalid request data');
    }

    throw error;
  }
}
