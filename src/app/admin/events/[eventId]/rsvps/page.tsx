import { Marcellus } from 'next/font/google';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { findEventById } from '@/lib/db/repositories/events';
import {
  findMealBreakdownForEvent,
  getEventRsvpReconstruction,
} from '@/lib/db/repositories/rsvpResponses';
import { EVENT_MEAL_OPTION_LABELS } from '@/lib/constants';
import { AdminTabs } from '@/components/admin/AdminTabs';
import Link from 'next/link';
import { EventRsvpTable, type EventRsvpRow } from './components/EventRsvpTable';

export const dynamic = 'force-dynamic';

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
});

export const metadata: Metadata = {
  title: 'Event RSVPs',
  description: 'Admin view of RSVP responses for a specific wedding event.',
};

/**
 * Format an ISO date string for display (e.g. "September 11, 2026").
 *
 * @param dateStr - ISO 8601 date string (YYYY-MM-DD).
 * @returns Formatted date string for display.
 */
function formatEventDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a 24-hour time string for display (e.g. "6:30 PM").
 *
 * @param timeStr - Time string in HH:MM format.
 * @returns Formatted 12-hour time string.
 */
function formatTime(timeStr: string): string {
  const [hoursStr, minutesStr] = timeStr.split(':');
  const hours = parseInt(hoursStr ?? '0', 10);
  const minutes = minutesStr ?? '00';
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;

  return `${displayHours}:${minutes} ${period}`;
}

/**
 * Admin page showing all RSVPs for a specific wedding event.
 *
 * Protected route - requires admin authentication.
 * Fetches all invited guests for the event and their RSVP responses,
 * then displays them in a searchable, filterable table.
 *
 * @param params - Route params containing the eventId segment.
 * @returns Event RSVP detail page.
 * @throws {Error} Redirects when user is unauthenticated or not an admin.
 */
export default async function EventRsvpsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const event = await findEventById(eventId);

  if (!event) {
    notFound();
  }

  // Reconstruct per-person RSVP status from stored data (attendees are recorded
  // by name under each party's response, so non-submitting members must be
  // matched back to their invited guest record), and fetch the meal preference
  // breakdown for attending guests of this event in parallel.
  const [{ rows: reconstructedRows }, mealBreakdown] = await Promise.all([
    getEventRsvpReconstruction(eventId),
    findMealBreakdownForEvent(eventId),
  ]);

  const isMainEvent = event.type === 'main';

  // Build EventRsvpRow array; each row is a single invited person
  const rows: EventRsvpRow[] = reconstructedRows.map((row) => {
    const guestName = `${row.firstName} ${row.lastName}`;

    return {
      id: row.guestId,
      guestName,
      partyName: row.partyName,
      invitationId: row.invitationId,
      rsvpStatus: row.status,
      hasPartyResponse: row.hasPartyResponse,
      partyRsvpUpdatedAt: row.partyRsvpUpdatedAt,
      // What the edit dialog pre-selects. Parties that RSVP'd through the main
      // wizard have no response row for the event, so their intent survives
      // only in the legacy per-guest `attending` column — without this fallback
      // opening the dialog would offer to decline people who already said yes.
      defaultAttending: row.hasPartyResponse
        ? row.status === 'attending'
        : isMainEvent && row.legacyAttending === true,
      // Per-person model: each row is one invited guest, so the count is 0 or 1.
      // The legacy party-level `RsvpResponse.numberOfAttending` column (a single
      // headcount per submitting party) is intentionally NOT read here — attendance
      // is reconstructed per person from Attendee name rows instead. Attendee rows
      // have been written alongside every response since the schema was introduced
      // (migration 0002), so no historical rows hold a headcount without matching
      // attendees that this 0/1 derivation would undercount.
      numberOfAttending: row.status === 'attending' ? 1 : 0,
      specialRequests: row.specialRequests,
      notes: row.notes,
      searchText: `${guestName} ${row.partyName}`.toLowerCase(),
    };
  });

  return (
    <div className="font-roboto min-h-screen bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Link
            href="/admin/events"
            className="text-sm text-[#9e3f3f] hover:underline"
          >
            ← Back to Events
          </Link>
        </div>

        <h1
          className={`${marcellus.className} mb-2 text-center text-5xl font-bold text-[#9e3f3f]`}
        >
          RSVPs: {event.name}
        </h1>

        <p className="mb-8 text-center text-[#6a5555]">
          {formatEventDate(event.eventDate)} &middot;{' '}
          {formatTime(event.startTime)} – {formatTime(event.endTime)}
        </p>

        <AdminTabs />

        <div className="mt-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#6a5555]">
              All RSVPs ({rows.length})
            </h2>

            <a
              href={`/api/admin/export/events/${eventId}/rsvps`}
              className="inline-flex items-center rounded-md bg-white px-4 py-2 text-sm font-medium text-[#6a5555] shadow ring-1 ring-gray-200 ring-inset hover:bg-[#f3dedb] hover:text-[#9e3f3f]"
            >
              Export CSV
            </a>
          </div>

          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
              <p className="text-gray-500">No guests have been invited yet.</p>
            </div>
          ) : (
            <EventRsvpTable
              data={rows}
              eventId={eventId}
              isMainEvent={isMainEvent}
            />
          )}
        </div>

        {mealBreakdown.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-4 text-xl font-semibold text-[#6a5555]">
              Meal Preferences
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {mealBreakdown.map((item) => (
                <div
                  key={item.mealOption}
                  className="rounded-lg border-l-4 border-[#b76565] bg-[#fffdfb] p-4 shadow"
                >
                  <p className="text-sm font-medium text-[#7a6666]">
                    {EVENT_MEAL_OPTION_LABELS[item.mealOption] ??
                      item.mealOption}
                  </p>
                  <p className="text-2xl font-bold text-[#9e3f3f]">
                    {item.count}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
