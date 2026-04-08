import { Marcellus } from 'next/font/google';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { guests } from '@/lib/db/schema';
import { AdminTabs } from '@/components/admin/AdminTabs';

export const dynamic = 'force-dynamic';

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
});

export const metadata: Metadata = {
  title: 'Guest RSVP Detail',
  description: 'Admin view of an individual guest RSVP status.',
};

const ATTENDANCE_LABELS: Record<string, string> = {
  attending: 'Attending',
  not_attending: 'Not Attending',
};

const MEAL_LABELS: Record<string, string> = {
  option_a: 'Option A',
  option_b: 'Option B',
};

/**
 * Admin guest RSVP detail page.
 *
 * Shows all events the guest is invited to with their per-event RSVP status,
 * attendee names, meal choices, and dietary notes.
 *
 * Protected route — requires admin role.
 *
 * @param props - Next.js page props with guestId route param.
 * @returns Admin guest detail page.
 * @throws {Error} Redirects when user lacks admin role; 404 when guest not found.
 */
export default async function AdminGuestDetailPage({
  params,
}: {
  params: Promise<{ guestId: string }>;
}) {
  const { guestId } = await params;

  const db = getDb();

  const guest = await db.query.guests.findFirst({
    where: eq(guests.id, guestId),
    with: {
      rsvpResponses: {
        with: {
          attendees: true,
          event: true,
        },
      },
      guestEvents: {
        with: {
          event: true,
        },
      },
    },
  });

  if (!guest) {
    notFound();
  }

  const guestName = `${guest.firstName} ${guest.lastName}`;

  // Build a lookup map for quick access to RSVP responses by eventId
  const rsvpByEvent = new Map(
    guest.rsvpResponses.map((rsvp) => [rsvp.eventId, rsvp]),
  );

  return (
    <div className="font-roboto flex min-h-screen flex-col items-center justify-start bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-4 sm:justify-center sm:p-8">
      <div className="w-full max-w-4xl">
        <h1
          className={`${marcellus.className} mb-4 text-center text-4xl font-bold text-[#9e3f3f] sm:text-5xl`}
        >
          {guestName}
        </h1>
        <AdminTabs />

        <div className="mt-6 flex items-center justify-between">
          <Link
            href="/admin/guests"
            className="text-sm text-[#9e3f3f] underline hover:text-[#7a3030]"
          >
            ← Back to guests
          </Link>
          <Link
            href={`/admin/guests/${guestId}/edit`}
            className="rounded-md bg-[#9e3f3f] px-4 py-2 text-sm font-medium text-white hover:bg-[#7a3030]"
          >
            Edit RSVPs
          </Link>
        </div>

        <div className="mt-6 space-y-4">
          {guest.guestEvents.map(({ event }) => {
            const rsvp = rsvpByEvent.get(event.id);
            const attendanceLabel = rsvp
              ? (ATTENDANCE_LABELS[rsvp.attendanceStatus] ??
                rsvp.attendanceStatus)
              : 'No Response';
            const statusColor =
              rsvp?.attendanceStatus === 'attending'
                ? 'border-green-500 bg-green-50'
                : rsvp?.attendanceStatus === 'not_attending'
                  ? 'border-red-400 bg-red-50'
                  : 'border-yellow-400 bg-yellow-50';

            return (
              <div
                key={event.id}
                className={`rounded-lg border-l-4 p-5 shadow ${statusColor}`}
              >
                <div className="flex items-start justify-between">
                  <h2 className="text-lg font-semibold text-[#9e3f3f]">
                    {event.name}
                  </h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      rsvp?.attendanceStatus === 'attending'
                        ? 'bg-green-100 text-green-800'
                        : rsvp?.attendanceStatus === 'not_attending'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {attendanceLabel}
                  </span>
                </div>

                {rsvp?.attendees && rsvp.attendees.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-2 text-sm font-medium text-[#7a6666]">
                      Attendees
                    </p>
                    <div className="space-y-2">
                      {rsvp.attendees.map((attendee) => (
                        <div
                          key={attendee.id}
                          className="rounded bg-white/60 px-3 py-2 text-sm text-[#6a5555]"
                        >
                          <span className="font-medium">{attendee.name}</span>
                          {' — '}
                          {attendee.mealOption
                            ? (MEAL_LABELS[attendee.mealOption] ??
                              attendee.mealOption)
                            : null}
                          {attendee.dietaryRestrictions && (
                            <span className="ml-2 text-[#9a8888]">
                              ({attendee.dietaryRestrictions})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {rsvp?.specialRequests && (
                  <p className="mt-3 text-sm text-[#7a6666]">
                    <span className="font-medium">Special requests: </span>
                    {rsvp.specialRequests}
                  </p>
                )}
              </div>
            );
          })}

          {guest.guestEvents.length === 0 && (
            <p className="rounded-lg bg-[#fffdfb] p-6 text-center text-[#7a6666] shadow">
              This guest is not invited to any events.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
