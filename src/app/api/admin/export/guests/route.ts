import { auth, getAuthIdentity } from '@/lib/auth';
import { findGuestsForVenueExport } from '@/lib/db/repositories/guests';
import { csvDownloadResponse, serializeToCsv } from '@/lib/csv';
import { MEAL_CHOICE_LABELS } from '@/lib/constants';

/** Ordered venue guest-list column headers (RFC 4180). */
const VENUE_HEADERS = [
  'Guest Name',
  'Party',
  'Guest Type',
  'Attending',
  'Meal Choice',
  'Dietary Restrictions / Allergies',
  'Notes',
] as const;

/**
 * Convert a guest's attending flag to a human-readable label.
 *
 * @param attending - The guest's wedding attendance flag.
 * @returns 'Yes', 'No', or 'No Response'.
 */
function formatAttending(attending: boolean | null): string {
  if (attending === null) {
    return 'No Response';
  }

  return attending ? 'Yes' : 'No';
}

/**
 * Convert a stored meal choice value to its display label.
 *
 * @param mealChoice - Raw meal choice value from the guest row.
 * @returns The display label, or the raw value when unrecognised.
 */
function formatMealChoice(mealChoice: string | null): string {
  if (!mealChoice) {
    return '';
  }

  return (
    MEAL_CHOICE_LABELS[mealChoice as keyof typeof MEAL_CHOICE_LABELS] ??
    mealChoice
  );
}

/**
 * GET /api/admin/export/guests?format=venue
 *
 * Generates a CSV download of all guests with their wedding attendance,
 * meal choice, and dietary restrictions for the venue. Requires an active
 * admin session.
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

  if (format !== 'venue') {
    return Response.json({ error: 'Unknown export format' }, { status: 400 });
  }

  const rows = await findGuestsForVenueExport();

  const dataRows = rows.map((row) => {
    const guestName = `${row.firstName} ${row.lastName}`;

    return [
      guestName,
      row.partyName ?? guestName,
      row.type === 'child' ? 'Child' : 'Adult',
      formatAttending(row.attending),
      formatMealChoice(row.mealChoice),
      row.dietaryRestrictions ?? '',
      row.notes ?? '',
    ];
  });

  const csv = serializeToCsv([...VENUE_HEADERS], dataRows);

  return csvDownloadResponse(csv, 'venue-guest-list.csv');
}
