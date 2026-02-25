'use server';

/**
 * Server actions for the login page.
 */
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';

export type DuplicateGuest = {
  guestId: string;
  address: string;
};

/**
 * Builds a human-readable address string from invitation fields.
 *
 * @param invitation - The invitation record with address fields.
 * @returns A formatted address string, or an empty string if no address data exists.
 */
function formatInvitationAddress(invitation: {
  mailingAddress: string | null;
  address: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
}): string {
  if (invitation.mailingAddress) {
    return invitation.mailingAddress;
  }

  if (!invitation.address) {
    return '';
  }

  const parts = [invitation.address];

  if (invitation.addressLine2) {
    parts.push(invitation.addressLine2);
  }

  if (invitation.city && invitation.state) {
    const cityState = `${invitation.city}, ${invitation.state}${invitation.zipCode ? ` ${invitation.zipCode}` : ''}`;

    parts.push(cityState);
  }

  return parts.join(', ');
}

/**
 * Finds all guests matching a given first and last name.
 *
 * Returns the list of matching guests with their invitation address when there
 * are multiple matches so the caller can present a disambiguation prompt.
 * Returns null when there is zero or one match (no disambiguation needed).
 *
 * @param firstName - The guest's first name to search for.
 * @param lastName - The guest's last name to search for.
 * @returns Array of duplicate guest records with addresses, or null if no duplicates.
 */
export async function findDuplicateGuests(
  firstName: string,
  lastName: string,
): Promise<DuplicateGuest[] | null> {
  const db = getDb();

  const matchingGuests = await db.query.guests.findMany({
    where: (table) =>
      sql`LOWER(${table.firstName}) = LOWER(${firstName}) AND LOWER(${table.lastName}) = LOWER(${lastName})`,
    with: {
      invitation: true,
    },
  });

  if (matchingGuests.length <= 1) {
    return null;
  }

  return matchingGuests.map((guest) => ({
    guestId: guest.id,
    address: formatInvitationAddress(guest.invitation),
  }));
}
