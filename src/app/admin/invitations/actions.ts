'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth, getAuthIdentity } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { generateUniqueInvitationCode } from '@/lib/invitation-code';
import * as InvitationRepository from '@/lib/db/repositories/invitations';
import * as GuestRepository from '@/lib/db/repositories/guests';
import * as GuestEventRepository from '@/lib/db/repositories/guestEvents';
import { invitationEditSchema } from '@/lib/schemas/invitation';

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
    const invitation =
      await InvitationRepository.findInvitationWithGuests(invitationId);

    if (!invitation) {
      return { success: false, error: 'Invitation not found' };
    }

    // Deduplicate event IDs to avoid unique constraint violations
    const uniqueEventIds = [...new Set(eventIds)];

    // Sync guestEvents for each guest: delete existing rows, insert granted ones
    for (const guest of invitation.guests) {
      await GuestEventRepository.deleteGuestEventsForGuest(guest.id);

      await GuestEventRepository.insertGuestEvents(
        uniqueEventIds.map((eventId) => ({
          id: crypto.randomUUID(),
          guestId: guest.id,
          eventId,
        })),
      );
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
    // generateUniqueInvitationCode requires a db client to check for collisions
    const db = getDb();
    const now = new Date().toISOString();

    const pending = await InvitationRepository.findInvitationsWithoutCode();

    if (pending.length === 0) {
      return { success: true, updatedCount: 0 };
    }

    let updatedCount = 0;

    for (const invitation of pending) {
      const code = await generateUniqueInvitationCode(db);

      await InvitationRepository.updateInvitation(invitation.id, {
        invitationCode: code,
        updatedAt: now,
      });

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
    const invitation =
      await InvitationRepository.findInvitationWithGuests(invitationId);

    if (!invitation) {
      return { success: false, error: 'Invitation not found' };
    }

    const now = new Date().toISOString();

    // Reset all guests' RSVP data
    for (const guest of invitation.guests) {
      await GuestRepository.resetGuestRsvpFields(guest.id, now);
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

const updateGuestTypeSchema = z.object({
  guestId: z.string().uuid(),
  type: z.enum(['adult', 'child']),
});

/**
 * Update the type (adult/child) of a single guest.
 *
 * Validates guestId (must be a UUID) and type before touching the database.
 * Returns a clear "Guest not found" error when guestId does not exist.
 *
 * @param guestId - The UUID of the guest to update.
 * @param type - The new guest type.
 * @returns Success status and optional error message.
 */
export async function updateGuestType(
  guestId: string,
  type: 'adult' | 'child',
): Promise<{ success: boolean; error?: string }> {
  const parsed = updateGuestTypeSchema.safeParse({ guestId, type });

  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const identity = getAuthIdentity(await auth());

  if (!identity || identity.type !== 'admin') {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const guest = await GuestRepository.findGuestById(parsed.data.guestId);

    if (!guest) {
      return { success: false, error: 'Guest not found' };
    }

    await GuestRepository.updateGuestFields(parsed.data.guestId, {
      type: parsed.data.type,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath('/admin/invitations');
    revalidatePath('/admin/guests');

    return { success: true };
  } catch (error) {
    console.error('Failed to update guest type:', error);

    return { success: false, error: 'Failed to update guest type' };
  }
}

/**
 * Update the editable details of an invitation.
 *
 * Validates input with `invitationEditSchema`, checks admin identity,
 * verifies the invitation exists, then writes all 10 editable fields to
 * the database. Surfaces a human-readable error for duplicate invitation code
 * unique constraint violations.
 *
 * @param invitationId - The ID of the invitation to update.
 * @param input - Raw form data to validate and persist.
 * @returns Success status and optional error message.
 * @throws ZodError if input fails schema validation.
 */
export async function updateInvitationDetails(
  invitationId: string,
  input: unknown,
): Promise<{ success: boolean; error?: string }> {
  const data = invitationEditSchema.parse(input);

  const identity = getAuthIdentity(await auth());

  if (!identity || identity.type !== 'admin') {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const invitation =
      await InvitationRepository.findInvitationWithGuests(invitationId);

    if (!invitation) {
      return { success: false, error: 'Invitation not found' };
    }

    await InvitationRepository.updateInvitation(invitationId, {
      mailingAddress: data.mailingAddress,
      relationshipToCouple: data.relationshipToCouple,
      totalInvited: data.totalInvited,
      invitationCode: data.invitationCode,
      address: data.address,
      addressLine2: data.addressLine2,
      city: data.city,
      state: data.state,
      zipCode: data.zipCode,
      country: data.country,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath('/admin/invitations');

    return { success: true };
  } catch (error) {
    console.error('Failed to update invitation:', error);

    if (
      error instanceof Error &&
      error.message.includes('UNIQUE constraint failed')
    ) {
      return {
        success: false,
        error: 'That invitation code is already in use',
      };
    }

    return { success: false, error: 'Failed to update invitation' };
  }
}
