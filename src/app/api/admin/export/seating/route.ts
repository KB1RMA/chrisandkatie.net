import { auth, getAuthIdentity } from '@/lib/auth';
import { findSeatingAssignmentsForExport } from '@/lib/db/repositories/seating';
import { csvDownloadResponse, serializeToCsv } from '@/lib/csv';
import { MEAL_CHOICE_LABELS } from '@/lib/constants';

/** Ordered seating-chart column headers for the coordinator (RFC 4180). */
const COORDINATOR_HEADERS = [
  'Table',
  'Seat',
  'Guest Name',
  'Party',
  'Meal Choice',
  'Dietary Restrictions / Allergies',
] as const;

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
 * GET /api/admin/export/seating?format=coordinator
 *
 * Generates a CSV download of the seating chart — one row per assigned
 * guest with table name, seat number, party, and meal details — for the
 * wedding coordinator. Requires an active admin session.
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

  if (format !== 'coordinator') {
    return Response.json({ error: 'Unknown export format' }, { status: 400 });
  }

  const rows = await findSeatingAssignmentsForExport();

  // Seat numbers restart at 1 within each table, in seatOrder sequence
  let currentTable: string | null = null;
  let seatNumber = 0;

  const dataRows = rows.map((row) => {
    if (row.tableName !== currentTable) {
      currentTable = row.tableName;
      seatNumber = 0;
    }

    seatNumber += 1;

    const guestName = `${row.firstName} ${row.lastName}`;

    return [
      row.tableName,
      String(seatNumber),
      guestName,
      row.partyName ?? guestName,
      formatMealChoice(row.mealChoice),
      row.dietaryRestrictions ?? '',
    ];
  });

  const csv = serializeToCsv([...COORDINATOR_HEADERS], dataRows);

  return csvDownloadResponse(csv, 'seating-chart.csv');
}
