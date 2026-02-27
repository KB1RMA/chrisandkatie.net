import { Marcellus } from 'next/font/google';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { events, guestEvents, rsvpResponses } from '@/lib/db/schema';
import { AdminTabs } from '@/components/admin/AdminTabs';
import { EventRsvpTable } from '@/components/admin/EventRsvpTable';

export const dynamic = 'force-dynamic';

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
});

export const metadata: Metadata = {
  title: 'Event RSVP Detail',
  description: 'Per-event guest RSVP list for admin.',
};

type AttendanceStatus = 'attending' | 'not_attending' | 'no_response';

const STATUS_SORT_ORDER: Record<AttendanceStatus, number> = {
  attending: 0,
  not_attending: 1,
  no_response: 2,
};

/**
 * Admin per-event RSVP detail page.
 *
 * Lists all guests invited to a specific event with their individual RSVP
 * status, sorted: attending → not_attending → no_response.
 *
 * Protected route — requires admin role.
 *
 * @param props - Next.js page props with eventId route param.
 * @returns Per-event RSVP detail page.
 * @throws {Error} Redirects when user lacks admin role; 404 when event not found.
 */
export default async function AdminEventRsvpPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const db = getDb();

  // Fetch the event itself to show its name
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event) {
    notFound();
  }

  // Fetch all guests invited to this event (with guest name data)
  const invitedGuests = await db.query.guestEvents.findMany({
    where: eq(guestEvents.eventId, eventId),
    with: {
      guest: true,
    },
  });

  // Fetch all RSVP responses for this event
  const eventRsvps = await db
    .select()
    .from(rsvpResponses)
    .where(eq(rsvpResponses.eventId, eventId));

  // Build a lookup map: guestId → attendanceStatus
  const rsvpByGuestId = new Map(
    eventRsvps.map((rsvp) => [rsvp.guestId, rsvp.attendanceStatus]),
  );

  // Derive status for each guest and sort attending → not_attending → no_response
  const rows = invitedGuests
    .map(({ guest }) => ({
      guestName: `${guest.firstName} ${guest.lastName}`,
      attendanceStatus: (rsvpByGuestId.get(guest.id) ??
        'no_response') as AttendanceStatus,
    }))
    .sort(
      (rowA, rowB) =>
        STATUS_SORT_ORDER[rowA.attendanceStatus] -
        STATUS_SORT_ORDER[rowB.attendanceStatus],
    );

  return (
    <div className="font-roboto flex min-h-screen flex-col items-center justify-start bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-4 sm:justify-center sm:p-8">
      <div className="w-full max-w-4xl">
        <h1
          className={`${marcellus.className} mb-4 text-center text-4xl font-bold text-[#9e3f3f] sm:text-5xl`}
        >
          {event.name}
        </h1>
        <AdminTabs />

        <div className="mt-6 mb-4 flex items-center">
          <Link
            href="/admin/rsvp"
            className="text-sm text-[#9e3f3f] underline hover:text-[#7a3030]"
          >
            ← Back to RSVP dashboard
          </Link>
        </div>

        <EventRsvpTable rows={rows} />
      </div>
    </div>
  );
}
