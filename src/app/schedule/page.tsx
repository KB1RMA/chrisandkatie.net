import { Marcellus } from 'next/font/google';
import { redirect } from 'next/navigation';
import { Button } from '@/components/Button';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { SCHEDULE_EVENTS } from '@/lib/events';

export const dynamic = 'force-dynamic';

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
    <div className="font-roboto flex flex-col items-center justify-start sm:justify-center min-h-screen bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-4 sm:p-8">
      <div className="w-full max-w-3xl">
        <h1
          className={`${marcellus.className} text-5xl sm:text-6xl font-bold text-[#9e3f3f] mb-4 text-center`}
        >
          Schedule
        </h1>

        <p className="text-xl text-[#6a5555] mb-12 text-center">
          Welcome, {guest.firstName}! Here's your personalized schedule.
        </p>

        <div className="space-y-6 mb-12">
          {visibleScheduleItems.map((item) => (
            <div
              key={item.id}
              className="bg-[#fffdfb] rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow duration-200"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                <div>
                  <h2
                    className={`${marcellus.className} text-2xl font-bold text-[#9e3f3f]`}
                  >
                    {item.event}
                  </h2>
                  <p className="text-[#7a6666]">
                    {item.date} • {item.day}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-[#9e3f3f]">
                    {item.endTime
                      ? `${item.time} - ${item.endTime}`
                      : item.time}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-[#6a5555]">
                <p className="flex items-center gap-2">
                  <span className="text-[#b76565]">📍</span>
                  <span className="font-medium">{item.location}</span>
                </p>
                <p className="text-[#7a6666]">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button href="/">Back Home</Button>
        </div>
      </div>
    </div>
  );
}
