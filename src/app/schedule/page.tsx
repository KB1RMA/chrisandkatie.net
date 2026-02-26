import { Marcellus } from 'next/font/google';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Button } from '@/components/Button';
import { ScheduleCard } from '@/components/ScheduleCard';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { SCHEDULE_EVENTS, isCurrentEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Schedule',
  description: 'Wedding celebration schedule and event details',
};

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
});

/**
 * Schedule page displaying celebration events filtered by guest permissions.
 *
 * Protected route - redirects to login if not authenticated.
 * Filters events based on guest's visibleEvents array.
 */
export default async function SchedulePage() {
  // Check authentication
  const session = await auth();

  if (!session?.user?.guestId) {
    redirect('/login?callbackUrl=/schedule');
  }

  // Get guest data with invitation to determine visible events
  const db = getDb();
  const guest = await db.query.guests.findFirst({
    where: (table, { eq }) => eq(table.id, session.user.guestId as string),
    with: {
      invitation: true,
    },
  });

  if (!guest || !guest.invitation) {
    redirect('/login?callbackUrl=/schedule');
  }

  // Parse visible events from invitation's JSON string
  let visibleEventIndices: number[] = [];

  try {
    visibleEventIndices = JSON.parse(guest.invitation.visibleEvents || '[]');
  } catch (error) {
    console.error('Failed to parse visibleEvents:', error);
  }

  // Filter schedule items based on guest permissions
  const visibleScheduleItems = SCHEDULE_EVENTS.filter((event) =>
    visibleEventIndices.includes(event.id),
  );

  return (
    <div className="font-roboto flex min-h-screen flex-col items-center justify-start bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-4 sm:justify-center sm:p-8">
      <div className="w-full max-w-3xl">
        <h1
          className={`${marcellus.className} mb-4 text-center text-5xl font-bold text-[#9e3f3f] sm:text-6xl`}
        >
          Schedule
        </h1>

        <p className="mb-12 text-center text-xl text-[#6a5555]">
          Welcome, {guest.firstName}! Here's your personalized schedule.
        </p>

        <div className="mb-12 space-y-6">
          {visibleScheduleItems.map((item) => (
            <ScheduleCard
              key={item.id}
              item={item}
              isCurrentEvent={isCurrentEvent(item)}
            />
          ))}
        </div>

        <div className="text-center">
          <Button href="/">Back Home</Button>
        </div>
      </div>
    </div>
  );
}
