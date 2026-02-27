import { Marcellus } from 'next/font/google';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { guestEvents, rsvpResponses } from '@/lib/db/schema';
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
  params: { eventId: string };
}) {
  const db = getDb();

  const event = await db.query.events.findFirst({
    where: (table, { eq: whereEq }) => whereEq(table.id, params.eventId),
  });

  if (!event) {
    notFound();
  }

  // Fetch all guest-event records and RSVP responses for this event in parallel
  const [guestEventRows, rsvpRows] = await Promise.all([
    db
      .select({ guestId: guestEvents.guestId, eventId: guestEvents.eventId })
      .from(guestEvents)
      .where(eq(guestEvents.eventId, params.eventId)),
    db
      .select()
      .from(rsvpResponses)
      .where(eq(rsvpResponses.eventId, params.eventId)),
  ]);

  const guestIds = guestEventRows.map((ge) => ge.guestId);

  // Fetch all invited guests with their invitation info
  const guestDetails =
    guestIds.length > 0
      ? await db.query.guests.findMany({
          where: (table, { inArray }) => inArray(table.id, guestIds),
          with: { invitation: true },
        })
      : [];

  // Build lookup maps for efficient row assembly
  const rsvpByGuestId = new Map(rsvpRows.map((r) => [r.guestId, r]));
  const guestById = new Map(guestDetails.map((g) => [g.id, g]));

  // Build EventRsvpRow array via a left join on guestId
  const rows: EventRsvpRow[] = guestEventRows
    .map((ge) => {
      const guest = guestById.get(ge.guestId);

      if (!guest) {
        return null;
      }

      const rsvp = rsvpByGuestId.get(ge.guestId);
      const partyName =
        guest.invitation?.mailingAddress?.trim() ||
        `${guest.firstName} ${guest.lastName}`;

      return {
        id: rsvp?.id ?? ge.guestId,
        guestName: `${guest.firstName} ${guest.lastName}`,
        partyName,
        rsvpStatus: (rsvp?.attendanceStatus ??
          'no_response') as EventRsvpRow['rsvpStatus'],
        numberOfAttending: rsvp?.numberOfAttending ?? 0,
        specialRequests: rsvp?.specialRequests ?? null,
        notes: guest.notes ?? null,
        searchText:
          `${guest.firstName} ${guest.lastName} ${partyName}`.toLowerCase(),
      };
    })
    .filter((row): row is EventRsvpRow => row !== null);

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
          </div>

          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
              <p className="text-gray-500">No guests have been invited yet.</p>
            </div>
          ) : (
            <EventRsvpTable data={rows} />
          )}
        </div>
      </div>
    </div>
  );
}
