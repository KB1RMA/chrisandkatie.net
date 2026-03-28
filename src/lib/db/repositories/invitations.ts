/**
 * Invitation repository — all database operations for the Invitation entity.
 *
 * This module owns query logic for invitations. Server Actions and other
 * callers should use these functions instead of calling the Drizzle client
 * directly.
 */

import { and, asc, count, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { guests, invitations } from '@/lib/db/schema';
import type { InvitationPrintRow } from '@/lib/print-inserts';

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

/**
 * Count the number of invitations that have no code assigned.
 * Used to display a warning on the print inserts page.
 *
 * @returns The count of invitations without an invitation code.
 */
export async function countInvitationsWithoutCode(): Promise<number> {
  const db = getDb();
  const result = await db
    .select({ count: count() })
    .from(invitations)
    .where(isNull(invitations.invitationCode));

  return result[0]?.count ?? 0;
}

/**
 * Format individual address fields into a multi-line mailing address string.
 * Returns null if no address data is present.
 */
function formatAddress(row: {
  address: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
}): string | null {
  const lines = [
    row.address,
    row.addressLine2,
    [row.city, row.state].filter(Boolean).join(', '),
    row.zipCode,
    row.country,
  ].filter(Boolean);

  return lines.length > 0 ? lines.join('\n') : null;
}

/**
 * Find all invitations that have a code assigned, returning raw rows grouped
 * by invitation with the primary guest label resolved. Callers are responsible
 * for assembling QR codes and deep-link URLs via assemblePrintInserts().
 *
 * @param invitationIds - Optional list of invitation IDs to filter to.
 * @returns Raw invitation rows sorted by creation order, ready for assembly.
 */
export async function findInvitationRowsForPrint(
  invitationIds?: string[],
): Promise<InvitationPrintRow[]> {
  const db = getDb();

  const whereCondition =
    invitationIds && invitationIds.length > 0
      ? and(
          isNotNull(invitations.invitationCode),
          inArray(invitations.id, invitationIds),
        )
      : isNotNull(invitations.invitationCode);

  const rows = await db
    .select({
      invitationId: invitations.id,
      invitationCode: invitations.invitationCode,
      mailingAddress: invitations.mailingAddress,
      address: invitations.address,
      addressLine2: invitations.addressLine2,
      city: invitations.city,
      state: invitations.state,
      zipCode: invitations.zipCode,
      country: invitations.country,
      guestFirstName: guests.firstName,
      guestLastName: guests.lastName,
      guestCreatedAt: guests.createdAt,
    })
    .from(invitations)
    .leftJoin(guests, eq(guests.invitationId, invitations.id))
    .where(whereCondition)
    .orderBy(asc(guests.createdAt));

  // Group rows by invitationId, picking the first guest as the household label
  const invitationMap = new Map<
    string,
    {
      invitationId: string;
      invitationCode: string;
      mailingAddress: string | null;
      primaryGuest: { firstName: string; lastName: string } | null;
    }
  >();

  rows.forEach((row) => {
    // Safety: skip rows with no invitation code (belt-and-suspenders guard)
    if (!row.invitationCode) {
      return;
    }

    if (!invitationMap.has(row.invitationId)) {
      invitationMap.set(row.invitationId, {
        invitationId: row.invitationId,
        invitationCode: row.invitationCode,
        mailingAddress: row.mailingAddress ?? formatAddress(row),
        primaryGuest:
          row.guestFirstName && row.guestLastName
            ? { firstName: row.guestFirstName, lastName: row.guestLastName }
            : null,
      });
    }
  });

  return Array.from(invitationMap.values()).map((entry) => {
    const householdLabel = entry.primaryGuest
      ? `${entry.primaryGuest.firstName} ${entry.primaryGuest.lastName}`
      : 'Unknown Household';

    return {
      invitationId: entry.invitationId,
      invitationCode: entry.invitationCode,
      householdLabel,
      mailingAddress: entry.mailingAddress,
    };
  });
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * The flattened, de-duplicated shape returned by `findInvitationsForExport`.
 * Address fields mirror the invitations table columns; primary guest name
 * fields come from the earliest-created guest on each invitation.
 */
export type InvitationExportRow = {
  id: string;
  mailingAddress: string | null;
  address: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  contactEmail: string | null;
  primaryGuestFirstName: string | null;
  primaryGuestLastName: string | null;
};

/**
 * Return all invitations as a flat list suitable for address-book export.
 *
 * Replicates the `leftJoin` + `orderBy asc(guests.createdAt)` +
 * application-level deduplication pattern from `findInvitationRowsForPrint`.
 * The first guest row encountered per invitation (lowest `createdAt`) becomes
 * the primary guest. Invitations with no linked guests are still included.
 *
 * @returns One `InvitationExportRow` per unique invitation, ordered by the
 *   earliest guest `createdAt` (ascending).
 */
export async function findInvitationsForExport(): Promise<
  InvitationExportRow[]
> {
  const db = getDb();

  const rows = await db
    .select({
      invitationId: invitations.id,
      mailingAddress: invitations.mailingAddress,
      address: invitations.address,
      addressLine2: invitations.addressLine2,
      city: invitations.city,
      state: invitations.state,
      zipCode: invitations.zipCode,
      country: invitations.country,
      contactEmail: invitations.contactEmail,
      guestFirstName: guests.firstName,
      guestLastName: guests.lastName,
      guestCreatedAt: guests.createdAt,
    })
    .from(invitations)
    .leftJoin(guests, eq(guests.invitationId, invitations.id))
    .orderBy(asc(guests.createdAt));

  // Deduplicate by invitationId, keeping the first row as the primary guest
  const invitationMap = new Map<string, InvitationExportRow>();

  rows.forEach((row) => {
    if (!invitationMap.has(row.invitationId)) {
      invitationMap.set(row.invitationId, {
        id: row.invitationId,
        mailingAddress: row.mailingAddress ?? null,
        address: row.address ?? null,
        addressLine2: row.addressLine2 ?? null,
        city: row.city ?? null,
        state: row.state ?? null,
        zipCode: row.zipCode ?? null,
        country: row.country ?? null,
        contactEmail: row.contactEmail ?? null,
        primaryGuestFirstName: row.guestFirstName ?? null,
        primaryGuestLastName: row.guestLastName ?? null,
      });
    }
  });

  return Array.from(invitationMap.values());
}
