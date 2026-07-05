import { auth, getAuthIdentity } from '@/lib/auth';
import { findInvitationsForExport } from '@/lib/db/repositories/invitations';
import { csvDownloadResponse, serializeToCsv } from '@/lib/csv';

/** Ordered Minted address-book column headers (RFC 4180). */
const MINTED_HEADERS = [
  'Name on Envelope',
  'Street Address 1',
  'Street Address 2 (Optional)',
  'City',
  'State/Region',
  'Zip/Postal Code',
  'Country',
  'Email (Optional)',
  'Phone (Optional)',
] as const;

/**
 * Resolve the "Name on Envelope" value for a single export row.
 * Uses mailingAddress when present; falls back to the primary guest full name.
 */
function resolveEnvelopeName(
  mailingAddress: string | null,
  firstName: string | null,
  lastName: string | null,
): string {
  if (mailingAddress) {
    return mailingAddress;
  }

  return [firstName, lastName].filter(Boolean).join(' ');
}

/**
 * GET /api/admin/export/invitations?format={formatId}
 *
 * Generates and returns a CSV file download of all invitation mailing
 * addresses. Requires an active admin session.
 *
 * @param request - The incoming HTTP request.
 * @returns 200 CSV download, 400 for unknown format, or 401 for non-admin.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  const identity = getAuthIdentity(session);

  if (identity?.type !== 'admin') {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');

  if (format !== 'minted') {
    return Response.json({ error: 'Unknown export format' }, { status: 400 });
  }

  const rows = await findInvitationsForExport();

  const dataRows = rows.map((row) => [
    resolveEnvelopeName(
      row.mailingAddress,
      row.primaryGuestFirstName,
      row.primaryGuestLastName,
    ),
    row.address ?? '',
    row.addressLine2 ?? '',
    row.city ?? '',
    row.state ?? '',
    row.zipCode ?? '',
    row.country ?? '',
    row.contactEmail ?? '',
    '',
  ]);

  const csv = serializeToCsv([...MINTED_HEADERS], dataRows);

  return csvDownloadResponse(csv, 'invitations-minted-address-book.csv');
}
