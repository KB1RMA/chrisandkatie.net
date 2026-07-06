import { auth, getAuthIdentity } from '@/lib/auth';
import { findEventById, findMainEvent } from '@/lib/db/repositories/events';
import { getEventRsvpReconstruction } from '@/lib/db/repositories/rsvpResponses';
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
 * GET /api/admin/export/seating?format=coordinator&eventId=...
 *
 * Generates a CSV download of an event's seating chart — one row per
 * assigned guest with table name, seat number, party, and meal details —
 * for the wedding coordinator. The event defaults to the main event when
 * no `eventId` param is given. Meal and dietary values prefer the
 * per-event attendee data (RsvpResponse/Attendee rows); for the main event
 * only they fall back to the guest-level columns written by the main RSVP
 * wizard. Requires an active admin session.
 *
 * @param request - The incoming HTTP request.
 * @returns 200 CSV download, 400 for unknown format or event, or 401 for
 *   non-admin.
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

  const eventIdParam = searchParams.get('eventId');
  const event = eventIdParam
    ? await findEventById(eventIdParam)
    : await findMainEvent();

  if (!event) {
    return Response.json({ error: 'Event not found' }, { status: 400 });
  }

  const [rows, reconstruction] = await Promise.all([
    findSeatingAssignmentsForExport(event.id),
    getEventRsvpReconstruction(event.id),
  ]);

  // Guest-level meal columns are written by the main RSVP wizard, so they
  // only apply as a fallback on the main event's chart.
  const useLegacyFallback = event.type === 'main';

  const reconstructedByGuestId = new Map(
    reconstruction.rows.map((row) => [row.guestId, row]),
  );

  // Seat numbers restart at 1 within each table, in seatOrder sequence.
  // Tables are tracked by id: names are editable and need not be unique.
  let currentTableId: string | null = null;
  let seatNumber = 0;

  const dataRows = rows.map((row) => {
    if (row.tableId !== currentTableId) {
      currentTableId = row.tableId;
      seatNumber = 0;
    }

    seatNumber += 1;

    const guestName = `${row.firstName} ${row.lastName}`;
    const reconstructed = reconstructedByGuestId.get(row.guestId);
    const mealChoice =
      reconstructed?.mealOption ?? (useLegacyFallback ? row.mealChoice : null);
    const dietaryRestrictions =
      reconstructed?.dietaryRestrictions ??
      (useLegacyFallback ? row.dietaryRestrictions : null);

    return [
      row.tableName,
      String(seatNumber),
      guestName,
      row.partyName?.trim() || guestName,
      formatMealChoice(mealChoice),
      dietaryRestrictions ?? '',
    ];
  });

  const csv = serializeToCsv([...COORDINATOR_HEADERS], dataRows);

  return csvDownloadResponse(csv, 'seating-chart.csv');
}
