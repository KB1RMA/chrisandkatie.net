/**
 * Guest repository — all database operations for the Guest entity.
 *
 * This module owns query logic for guests. Server Actions and other callers
 * should use these functions instead of calling the Drizzle client directly.
 */

import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { guests } from '@/lib/db/schema';

export type UpdateGuestValues = Partial<typeof guests.$inferInsert>;

/**
 * Typed input for inserting a new guest row.
 *
 * Derived from the schema's inferred insert type. The `id` field is required;
 * `createdAt` and `updatedAt` are optional and default to the current
 * timestamp inside `createGuest` when not provided.
 */
export type NewGuestData = Pick<
  typeof guests.$inferInsert,
  'id' | 'invitationId' | 'firstName' | 'lastName' | 'type'
> &
  Partial<Pick<typeof guests.$inferInsert, 'createdAt' | 'updatedAt'>>;

/**
 * Find a single guest by their primary key.
 *
 * @param id - The guest id to look up.
 * @returns The guest row, or undefined if not found.
 */
export async function findGuestById(id: string) {
  return getDb().query.guests.findFirst({
    where: eq(guests.id, id),
  });
}

/**
 * Find a guest by id and eagerly load their invitation with all guests on it.
 *
 * @param id - The guest id to look up.
 * @returns The guest row with nested invitation and guests, or undefined.
 */
export async function findGuestWithInvitationAndPeers(id: string) {
  return getDb().query.guests.findFirst({
    where: eq(guests.id, id),
    with: {
      invitation: {
        with: {
          guests: true,
        },
      },
    },
  });
}

/**
 * Update arbitrary fields on a guest row.
 *
 * @param id - The guest id to update.
 * @param values - Partial column values to write.
 */
export async function updateGuestFields(
  id: string,
  values: UpdateGuestValues,
): Promise<void> {
  await getDb().update(guests).set(values).where(eq(guests.id, id));
}

/**
 * Clear all RSVP-related fields on a guest back to their initial null state.
 *
 * @param id - The guest id to reset.
 * @param now - ISO timestamp to use for updatedAt.
 */
export async function resetGuestRsvpFields(
  id: string,
  now: string,
): Promise<void> {
  await getDb()
    .update(guests)
    .set({
      attending: null,
      mealChoice: null,
      dietaryRestrictions: null,
      notes: null,
      updatedAt: now,
    })
    .where(eq(guests.id, id));
}

/**
 * Insert a new guest row into the guests table.
 *
 * `createdAt` and `updatedAt` default to the current ISO timestamp when
 * not supplied by the caller.
 *
 * @param data - The guest fields to insert.
 */
export async function createGuest(data: NewGuestData): Promise<void> {
  const now = new Date().toISOString();

  await getDb()
    .insert(guests)
    .values({ createdAt: now, updatedAt: now, ...data });
}

/**
 * Delete a guest row by primary key.
 *
 * Cascade deletes for GuestEvent and RsvpResponse rows are handled
 * by the database schema foreign key constraints.
 *
 * @param guestId - The id of the guest to delete.
 */
export async function deleteGuest(guestId: string): Promise<void> {
  await getDb().delete(guests).where(eq(guests.id, guestId));
}
