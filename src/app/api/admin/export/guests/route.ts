import { auth, getAuthIdentity } from '@/lib/auth';
import { findGuestsForVenueExport } from '@/lib/db/repositories/guests';
import { findEventById } from '@/lib/db/repositories/events';
import { getEventRsvpReconstruction } from '@/lib/db/repositories/rsvpResponses';
import { csvDownloadResponse, serializeToCsv } from '@/lib/csv';
import { EVENT_MEAL_OPTION_LABELS, MEAL_CHOICE_LABELS } from '@/lib/constants';
import type { EventReconstructionStatus } from '@/lib/rsvp';

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

/** Extra column appended when a seating chart event is joined in. */
const TABLE_HEADER = 'Table' as const;

/**
 * Convert a guest's attending flag to a human-readable label.
 *
 * @param attending - The guest's attendance flag, or null when unanswered.
 * @returns 'Yes', 'No', or 'No Response'.
 */
function formatAttending(attending: boolean | null): string {
  if (attending === null) {
    return 'No Response';
  }

  return attending ? 'Yes' : 'No';
}

/**
 * Convert a stored meal value to its display label.
 *
 * Checks the per-event option labels (option_a/option_b) first, then the
 * wedding meal labels, falling back to the raw value.
 *
 * @param mealChoice - Raw meal value from the guest or attendee row.
 * @returns The display label, or the raw value when unrecognised.
 */
function formatMealChoice(mealChoice: string | null): string {
  if (!mealChoice) {
    return '';
  }

  return (
    EVENT_MEAL_OPTION_LABELS[
      mealChoice as keyof typeof EVENT_MEAL_OPTION_LABELS
    ] ??
    MEAL_CHOICE_LABELS[mealChoice as keyof typeof MEAL_CHOICE_LABELS] ??
    mealChoice
  );
}

/**
 * Resolve a guest's attendance label for the requested event.
 *
 * Prefers the event's reconstructed RSVP status; falls back to the
 * guest-level flag only where that flag applies. A guest with no
 * reconstruction row was never invited to the event.
 *
 * @param status - Reconstructed status, or undefined when not invited.
 * @param legacyAttending - The guest-level wedding attendance flag.
 * @param useLegacyFallback - Whether the guest-level flag describes this export.
 * @returns The display label for the Attending column.
 */
function resolveAttending(
  status: EventReconstructionStatus | undefined,
  legacyAttending: boolean | null,
  useLegacyFallback: boolean,
): string {
  if (status === 'attending') {
    return 'Yes';
  }

  if (status === 'not_attending') {
    return 'No';
  }

  if (useLegacyFallback) {
    return formatAttending(legacyAttending);
  }

  return status === 'no_response' ? 'No Response' : 'Not Invited';
}

/**
 * Build the download filename, qualified by event when one was requested so
 * per-event downloads do not all collide on the same name.
 *
 * @param eventName - The requested event's name, or null for the plain export.
 * @returns A filesystem-safe CSV filename.
 */
function buildFilename(eventName: string | null): string {
  if (!eventName) {
    return 'venue-guest-list.csv';
  }

  const slug = eventName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug ? `venue-guest-list-${slug}.csv` : 'venue-guest-list.csv';
}

/**
 * GET /api/admin/export/guests?format=venue&eventId=...
 *
 * Generates a CSV download of all guests with their attendance, meal choice,
 * and dietary restrictions for the venue. When an `eventId` is given, an
 * extra `Table` column is appended with each guest's seating chart
 * assignment for that event (blank when unseated), and attendance/meal
 * details are resolved from that event's RSVPs rather than the main wedding
 * RSVP. Requires an active admin session.
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

  if (format !== 'venue') {
    return Response.json({ error: 'Unknown export format' }, { status: 400 });
  }

  const eventIdParam = searchParams.get('eventId');
  const event = eventIdParam ? await findEventById(eventIdParam) : null;

  if (eventIdParam && !event) {
    return Response.json({ error: 'Event not found' }, { status: 400 });
  }

  const [rows, reconstruction] = await Promise.all([
    findGuestsForVenueExport(event?.id),
    event ? getEventRsvpReconstruction(event.id) : null,
  ]);

  // Guest-level attendance/meal columns are written by the main RSVP wizard,
  // so they only apply to the plain export and the main event's chart. For
  // any other event those columns describe a different party entirely.
  const useLegacyFallback = !event || event.type === 'main';

  const reconstructedByGuestId = new Map(
    (reconstruction?.rows ?? []).map((row) => [row.guestId, row]),
  );

  const dataRows = rows.map((row) => {
    const guestName = `${row.firstName} ${row.lastName}`;
    const reconstructed = reconstructedByGuestId.get(row.guestId);
    const mealChoice =
      reconstructed?.mealOption ?? (useLegacyFallback ? row.mealChoice : null);
    const dietaryRestrictions =
      reconstructed?.dietaryRestrictions ??
      (useLegacyFallback ? row.dietaryRestrictions : null);

    const cells = [
      guestName,
      row.partyName ?? guestName,
      row.type === 'child' ? 'Child' : 'Adult',
      resolveAttending(reconstructed?.status, row.attending, useLegacyFallback),
      formatMealChoice(mealChoice),
      dietaryRestrictions ?? '',
      row.notes ?? '',
    ];

    return event ? [...cells, row.tableName ?? ''] : cells;
  });

  const headers = event ? [...VENUE_HEADERS, TABLE_HEADER] : [...VENUE_HEADERS];

  const csv = serializeToCsv(headers, dataRows);

  return csvDownloadResponse(csv, buildFilename(event?.name ?? null));
}
