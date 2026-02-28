/**
 * Invitation repository — all database operations for the Invitation entity.
 *
 * This module owns query logic for invitations. Server Actions and other
 * callers should use these functions instead of calling the Drizzle client
 * directly.
 */

import { eq, isNull } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { invitations } from '@/lib/db/schema';

export type UpdateInvitationValues = Partial<typeof invitations.$inferInsert>;

/**
 * Find a single invitation by id, eagerly loading all guests on it.
 *
 * @param id - The invitation id to look up.
 * @returns The invitation row with nested guests, or undefined if not found.
 */
export async function findInvitationWithGuests(id: string) {
  return getDb().query.invitations.findFirst({
    where: eq(invitations.id, id),
    with: { guests: true },
  });
}

/**
 * Update arbitrary fields on an invitation row.
 *
 * @param id - The invitation id to update.
 * @param values - Partial column values to write.
 */
export async function updateInvitation(
  id: string,
  values: UpdateInvitationValues,
): Promise<void> {
  await getDb().update(invitations).set(values).where(eq(invitations.id, id));
}

/**
 * Return all invitations that have no invitation code assigned yet.
 * Only the id and invitationCode columns are fetched.
 *
 * @returns Minimal invitation rows pending code assignment.
 */
export async function findInvitationsWithoutCode() {
  return getDb().query.invitations.findMany({
    where: isNull(invitations.invitationCode),
    columns: { id: true, invitationCode: true },
  });
}
