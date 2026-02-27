'use server';

/**
 * Server actions for RSVP submission and data retrieval.
 */
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { guests, invitations, users, rsvpResponses } from '@/lib/db/schema';
import { submitRsvpSchema, type SubmitRsvpInput } from '@/lib/schemas/rsvp';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

/**
 * Update RSVP responses for all guests on an invitation.
 * Optionally persists contactEmail to Invitation and User tables.
 *
 * @throws Error if user is not authenticated or not authorized
 */
export async function submitRsvp(input: SubmitRsvpInput) {
  try {
    // Check authentication
    const session = await auth();

    const hasGuestSession = !!session?.user?.guestId;
    const hasInvitationSession = !!session?.user?.invitationId;

    if (!hasGuestSession && !hasInvitationSession) {
      throw new Error('Unauthorized');
    }

    // Validate input
    const validatedData = submitRsvpSchema.parse(input);

    const db = getDb();

    // Resolve the authorized invitation ID from session
    let authorizedInvitationId: string;

    if (hasInvitationSession) {
      // Invitation-code flow: invitationId is directly in the session
      authorizedInvitationId = session!.user.invitationId as string;

      if (authorizedInvitationId !== validatedData.invitationId) {
        throw new Error('Not authorized for this invitation');
      }
    } else {
      // Legacy name-based flow: verify via guest lookup
      const loggedInGuest = await db.query.guests.findFirst({
        where: (table, { eq: eqFn }) =>
          eqFn(table.id, session!.user.guestId as string),
      });

      if (
        !loggedInGuest ||
        loggedInGuest.invitationId !== validatedData.invitationId
      ) {
        throw new Error('Not authorized for this invitation');
      }

      authorizedInvitationId = loggedInGuest.invitationId;
    }

    // Update each guest
    const now = new Date().toISOString();

    for (const guestUpdate of validatedData.guests) {
      // Verify guest belongs to this invitation
      const guest = await db.query.guests.findFirst({
        where: (table, { eq: eqFn }) => eqFn(table.id, guestUpdate.id),
      });

      if (!guest || guest.invitationId !== authorizedInvitationId) {
        continue; // Skip guests not on this invitation
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: Record<string, any> = {
        attending: guestUpdate.attending,
        mealChoice: guestUpdate.mealChoice,
        dietaryRestrictions: guestUpdate.dietaryRestrictions,
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

    // Persist contact email when provided
    const contactEmail = validatedData.contactEmail?.trim();

    if (contactEmail) {
      try {
        await db
          .update(invitations)
          .set({ contactEmail, updatedAt: now })
          .where(eq(invitations.id, authorizedInvitationId));

        const userId = session!.user.id;

        if (userId) {
          await db
            .update(users)
            .set({ email: contactEmail, updatedAt: now })
            .where(eq(users.id, userId));
        }
      } catch (emailError) {
        console.error(
          '[submitRsvp] Failed to persist contact email:',
          emailError,
        );
      }
    }

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error('Invalid request data');
    }

    throw error;
  }
}

/**
 * Fetch all events a guest is invited to, including their existing RSVP status.
 *
 * Uses the guest_event junction table to determine which events the authenticated
 * guest can access. Returns each event with the guest's current RSVP response.
 *
 * @returns Array of events with RSVP status for authenticated guest.
 * @throws Error if user is not authenticated.
 */
export async function fetchGuestEvents() {
  const session = await auth();

  if (!session?.user?.guestId) {
    throw new Error('Unauthorized');
  }

  const db = getDb();
  const guestId = session.user.guestId as string;

  // Fetch all events guest is invited to via junction table
  const guestEventRows = await db.query.guestEvents.findMany({
    where: (table, { eq: eqFn }) => eqFn(table.guestId, guestId),
    with: {
      event: true,
    },
  });

  // Fetch existing RSVP responses for this guest
  const rsvpRows = await db
    .select()
    .from(rsvpResponses)
    .where(eq(rsvpResponses.guestId, guestId));

  const rsvpByEventId = new Map(rsvpRows.map((r) => [r.eventId, r]));

  return guestEventRows.map(({ event: eventRow }) => ({
    event: eventRow,
    rsvp: rsvpByEventId.get(eventRow.id) ?? null,
  }));
}
