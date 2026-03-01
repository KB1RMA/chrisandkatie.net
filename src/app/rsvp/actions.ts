'use server';

/**
 * Server actions for RSVP submission and data retrieval.
 */
import { auth, getAuthIdentity } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { users } from '@/lib/db/schema';
import {
  submitRsvpSchema,
  updateInvitationAddressSchema,
  type SubmitRsvpInput,
  type UpdateInvitationAddressInput,
} from '@/lib/schemas/rsvp';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import * as GuestRepository from '@/lib/db/repositories/guests';
import * as InvitationRepository from '@/lib/db/repositories/invitations';
import * as GuestEventRepository from '@/lib/db/repositories/guestEvents';
import * as RsvpRepository from '@/lib/db/repositories/rsvpResponses';

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

    const identity = getAuthIdentity(session);

    if (!identity) {
      throw new Error('Unauthorized');
    }

    // Validate input
    const validatedData = submitRsvpSchema.parse(input);

    // Guests can only submit for their own invitation; admins can submit for any
    if (
      identity.type === 'guest' &&
      identity.invitationId !== validatedData.invitationId
    ) {
      throw new Error('Not authorized for this invitation');
    }

    const authorizedInvitationId =
      identity.type === 'guest'
        ? identity.invitationId
        : validatedData.invitationId;

    // Update each guest
    const now = new Date().toISOString();

    for (const guestUpdate of validatedData.guests) {
      // Verify guest belongs to this invitation
      const guest = await GuestRepository.findGuestById(guestUpdate.id);

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

      await GuestRepository.updateGuestFields(guestUpdate.id, updateData);
    }

    // Persist contact email when provided
    const contactEmail = validatedData.contactEmail?.trim();

    if (contactEmail) {
      try {
        await InvitationRepository.updateInvitation(authorizedInvitationId, {
          contactEmail,
          updatedAt: now,
        });

        const userId = session?.user.id;

        if (userId) {
          const db = getDb();

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
  const identity = getAuthIdentity(session);

  if (identity?.type !== 'guest') {
    throw new Error('Unauthorized');
  }

  // Load all guests for this invitation to query their events
  const invitation = await InvitationRepository.findInvitationWithGuests(
    identity.invitationId,
  );

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  const guestIds = invitation.guests.map((g) => g.id);

  if (guestIds.length === 0) {
    return [];
  }

  // Fetch all events guests are invited to via junction table
  const guestEventRows =
    await GuestEventRepository.findGuestEventsForGuestIds(guestIds);

  // Fetch existing RSVP responses for all guests on this invitation
  const rsvpRows = await RsvpRepository.findRsvpsByGuestIds(guestIds);

  const rsvpByEventId = new Map(rsvpRows.map((r) => [r.eventId, r]));

  // Deduplicate events (multiple guests may be assigned to the same event)
  // and exclude events where rsvpRequired is not true
  const seenEventIds = new Set<string>();

  return guestEventRows
    .filter(({ event }) => {
      if (!event.rsvpRequired) {
        return false;
      }

      if (seenEventIds.has(event.id)) {
        return false;
      }

      seenEventIds.add(event.id);

      return true;
    })
    .map(({ event }) => ({
      event,
      rsvp: rsvpByEventId.get(event.id) ?? null,
    }));
}

/**
 * Update the mailing address fields for the authenticated guest's invitation.
 *
 * @param input - The updated address fields.
 * @throws Error if the user is not authenticated or not authorized for this invitation.
 */
export async function updateInvitationAddress(
  input: UpdateInvitationAddressInput,
): Promise<{ success: boolean }> {
  try {
    const session = await auth();
    const identity = getAuthIdentity(session);

    if (!identity) {
      throw new Error('Unauthorized');
    }

    // Validate input before touching any data
    const validatedInput = updateInvitationAddressSchema.parse(input);

    if (
      identity.type === 'guest' &&
      identity.invitationId !== validatedInput.invitationId
    ) {
      throw new Error('Not authorized for this invitation');
    }

    const authorizedInvitationId =
      identity.type === 'guest'
        ? identity.invitationId
        : validatedInput.invitationId;

    const now = new Date().toISOString();

    const contactEmail = validatedInput.contactEmail?.trim() || undefined;

    await InvitationRepository.updateInvitation(authorizedInvitationId, {
      mailingAddress: validatedInput.mailingAddress,
      address: validatedInput.address,
      addressLine2: validatedInput.addressLine2,
      city: validatedInput.city,
      state: validatedInput.state,
      zipCode: validatedInput.zipCode,
      ...(contactEmail ? { contactEmail } : {}),
      updatedAt: now,
    });

    if (contactEmail) {
      try {
        const userId = session?.user.id;

        if (userId) {
          const db = getDb();

          await db
            .update(users)
            .set({ email: contactEmail, updatedAt: now })
            .where(eq(users.id, userId));
        }
      } catch (emailError) {
        console.error(
          '[updateInvitationAddress] Failed to persist contact email:',
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
