import { Marcellus } from 'next/font/google';
import type { Metadata } from 'next';
import { sql, eq, asc } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { events, rsvpResponses, attendees } from '@/lib/db/schema';
import { getEventRsvpReconstruction } from '@/lib/db/repositories/rsvpResponses';
import { AdminTabs } from '@/components/admin/AdminTabs';
import {
  RsvpDashboard,
  type MealBreakdownItem,
} from '@/components/admin/RsvpDashboard';
import type { EventSummaryCardProps } from '@/components/admin/EventSummaryCard';

export const dynamic = 'force-dynamic';

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
});

export const metadata: Metadata = {
  title: 'RSVPs',
  description:
    'Admin RSVP summary dashboard with headcounts and meal preferences.',
};

/**
 * Admin RSVP summary dashboard page.
 *
 * Displays per-event headcounts (attending, not attending, no response) and
 * a meal preference breakdown across all attending guests.
 *
 * Protected route — requires admin role.
 *
 * @returns Admin RSVP dashboard page.
 * @throws {Error} Redirects when user lacks admin role.
 */
export default async function AdminRsvpPage() {
  const db = getDb();

  // Fetch all events ordered by sortOrder
  const allEvents = await db
    .select({
      id: events.id,
      name: events.name,
      sortOrder: events.sortOrder,
    })
    .from(events)
    .orderBy(asc(events.sortOrder));

  // Reconstruct per-person RSVP counts for each event from stored data
  // (attendees are recorded by name under each party's response).
  const eventReconstructions = await Promise.all(
    allEvents.map((event) => getEventRsvpReconstruction(event.id)),
  );

  // Fetch meal preference breakdown for attending guests
  const mealCounts = await db
    .select({
      mealOption: attendees.mealOption,
      count: sql<number>`count(*)`,
    })
    .from(attendees)
    .innerJoin(rsvpResponses, eq(attendees.rsvpResponseId, rsvpResponses.id))
    .where(eq(rsvpResponses.attendanceStatus, 'attending'))
    .groupBy(attendees.mealOption);

  // Build per-event summary cards from the reconstructed counts
  const eventSummaries: EventSummaryCardProps[] = allEvents.map(
    (event, index) => {
      const { summary } = eventReconstructions[index];

      return {
        eventId: event.id,
        eventName: event.name,
        attending: summary.attending,
        notAttending: summary.notAttending,
        noResponse: summary.noResponse,
      };
    },
  );

  const mealBreakdown: MealBreakdownItem[] = mealCounts.map((item) => ({
    mealOption: item.mealOption as 'option_a' | 'option_b',
    count: Number(item.count),
  }));

  return (
    <div className="font-roboto flex min-h-screen flex-col items-center justify-start bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-4 sm:justify-center sm:p-8">
      <div className="w-full max-w-6xl">
        <h1
          className={`${marcellus.className} mb-4 text-center text-4xl font-bold text-[#9e3f3f] sm:text-5xl`}
        >
          RSVP Dashboard
        </h1>
        <AdminTabs />
        <p className="mt-6 mb-6 text-center text-lg text-[#6a5555]">
          Real-time RSVP headcounts and meal preferences across all events.
        </p>
        <RsvpDashboard
          eventSummaries={eventSummaries}
          mealBreakdown={mealBreakdown}
        />
      </div>
    </div>
  );
}
