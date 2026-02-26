import { Marcellus } from 'next/font/google';
import type { Metadata } from 'next';
import { asc } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { AdminTabs } from '@/components/admin/AdminTabs';
import { getEventRsvpSummary } from './actions';
import { EventCard } from './components/EventCard';
import { CreateEventButton } from './components/CreateEventButton';

export const dynamic = 'force-dynamic';

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
});

export const metadata: Metadata = {
  title: 'Events',
  description: 'Admin view of wedding events and RSVP summaries.',
};

/**
 * Admin events dashboard page showing all wedding events in sortOrder order.
 *
 * Protected route - requires admin authentication.
 * Displays each event's details and attending RSVP count.
 *
 * @returns Admin events list page.
 * @throws {Error} Redirects when user is unauthenticated or not an admin.
 */
export default async function AdminEventsPage() {
  const db = getDb();

  const allEvents = await db
    .select()
    .from(events)
    .orderBy(asc(events.sortOrder));

  // Fetch RSVP summaries for all events in parallel
  const rsvpSummaries = await Promise.all(
    allEvents.map((event) => getEventRsvpSummary({ eventId: event.id })),
  );

  const eventsWithRsvpSummaries = allEvents.map((event, index) => {
    const summaryResult = rsvpSummaries[index];
    const rsvpSummary =
      summaryResult?.success === true && summaryResult.data
        ? summaryResult.data
        : { attending: 0, notAttending: 0, noResponse: 0, total: 0 };

    return { event, rsvpSummary };
  });

  return (
    <div className="font-roboto min-h-screen bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <h1
          className={`${marcellus.className} mb-8 text-center text-5xl font-bold text-[#9e3f3f]`}
        >
          Events
        </h1>

        <AdminTabs />

        <div className="mt-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[#6a5555]">
              All Events ({allEvents.length})
            </h2>
            <CreateEventButton />{' '}
          </div>

          {eventsWithRsvpSummaries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
              <p className="text-gray-500">No events created yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {eventsWithRsvpSummaries.map(({ event, rsvpSummary }) => (
                <EventCard
                  key={event.id}
                  event={event}
                  rsvpSummary={rsvpSummary}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
