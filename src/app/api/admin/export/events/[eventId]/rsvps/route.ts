import { auth, getAuthIdentity } from '@/lib/auth';
import { findEventById } from '@/lib/db/repositories/events';
import {
  findEventRsvpRowsForExport,
  type EventRsvpExportRow,
} from '@/lib/db/repositories/rsvpResponses';
import { csvDownloadResponse, serializeToCsv } from '@/lib/csv';
import { EVENT_MEAL_OPTION_LABELS, MEAL_CHOICE_LABELS } from '@/lib/constants';

/** Ordered per-event RSVP export column headers (RFC 4180). */
const EVENT_RSVP_HEADERS = [
  'Guest Name',
  'Party',
  'RSVP Status',
  'Meal Choice',
  'Dietary Restrictions / Allergies',
  'Special Requests',
  'Guest Notes',
] as const;

/**
 * Convert an RSVP attendance status to a human-readable label.
 *
 * @param status - The guest's reconstructed attendance status.
 * @returns Human-readable RSVP status label.
 */
function formatRsvpStatus(status: EventRsvpExportRow['attendanceStatus']) {
  if (status === 'attending') {
    return 'Attending';
  }

  if (status === 'not_attending') {
    return 'Not Attending';
  }

  return 'No Response';
}

/**
 * Convert a stored attendee meal option to its display label.
 *
 * Checks the event option labels (option_a/option_b) first, then the wedding
 * meal labels, falling back to the raw value.
 *
 * @param mealOption - Raw meal option value from the attendee row.
 * @returns The display label, or the raw value when unrecognised.
 */
function formatMealOption(mealOption: string | null): string {
  if (!mealOption) {
    return '';
  }

  return (
    EVENT_MEAL_OPTION_LABELS[
      mealOption as keyof typeof EVENT_MEAL_OPTION_LABELS
    ] ??
    MEAL_CHOICE_LABELS[mealOption as keyof typeof MEAL_CHOICE_LABELS] ??
    mealOption
  );
}

/**
 * Build a filesystem-safe filename slug from an event name.
 *
 * @param name - The event name.
 * @returns Lowercased slug with non-alphanumerics collapsed to hyphens.
 */
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'event'
  );
}

/**
 * GET /api/admin/export/events/{eventId}/rsvps
 *
 * Generates a CSV download of all invited guests for an event with their
 * reconstructed RSVP status and meal details (matching the admin RSVP
 * dashboard). Requires an active admin session.
 *
 * @param request - The incoming HTTP request.
 * @param context - Route context containing the eventId param.
 * @returns 200 CSV download, 404 for unknown event, or 401 for non-admin.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ eventId: string }> },
): Promise<Response> {
  const session = await auth();
  const identity = getAuthIdentity(session);

  if (identity?.type !== 'admin') {
    return new Response('Unauthorized', { status: 401 });
  }

  const { eventId } = await context.params;

  const event = await findEventById(eventId);

  if (!event) {
    return Response.json({ error: 'Event not found' }, { status: 404 });
  }

  const rows = await findEventRsvpRowsForExport(eventId);

  const dataRows = rows.map((row) => {
    const guestName = `${row.guestFirstName} ${row.guestLastName}`;

    return [
      guestName,
      row.partyName,
      formatRsvpStatus(row.attendanceStatus),
      formatMealOption(row.mealOption),
      row.dietaryRestrictions ?? '',
      row.specialRequests ?? '',
      row.guestNotes ?? '',
    ];
  });

  const csv = serializeToCsv([...EVENT_RSVP_HEADERS], dataRows);

  return csvDownloadResponse(csv, `${slugify(event.name)}-rsvps.csv`);
}
