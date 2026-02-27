import { Marcellus } from 'next/font/google';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { eq, asc, inArray } from 'drizzle-orm';
import { Button } from '@/components/Button';
import { ScheduleCard } from '@/components/ScheduleCard';
import { auth, getAuthIdentity } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { events, guestEvents } from '@/lib/db/schema';
import { isCurrentEvent } from '@/lib/schedule-utils';
import type { WeddingEvent } from '@/lib/db/schema';

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
 * Schedule page displaying celebration events.
 *
 * Protected route — redirects to login if not authenticated.
 * Admins see all events with their username as the welcome name.
 * Guests see only their party's assigned events via invitationId lookup.
 */
export default async function SchedulePage() {
  const session = await auth();
  const identity = getAuthIdentity(session);

  if (!identity) {
    redirect('/login?callbackUrl=/schedule');
  }

  const db = getDb();

  let welcomeName: string;
  let displayEvents: WeddingEvent[];

  if (identity.type === 'admin') {
    welcomeName = identity.username;
    displayEvents = await db
      .select()
      .from(events)
      .orderBy(asc(events.sortOrder));
  } else {
    // Guest path: look up invitation and filter events for the whole party
    const invitation = await db.query.invitations.findFirst({
      where: (table, { eq: eqFn }) => eqFn(table.id, identity.invitationId),
      with: { guests: true },
    });

    if (!invitation || invitation.guests.length === 0) {
      redirect('/login?callbackUrl=/schedule');
    }

    welcomeName = invitation.guests.map((g) => g.firstName).join(' & ');

    const guestIds = invitation.guests.map((g) => g.id);

    const visibleEventRows = await db
      .selectDistinct({ event: events })
      .from(guestEvents)
      .innerJoin(events, eq(guestEvents.eventId, events.id))
      .where(inArray(guestEvents.guestId, guestIds))
      .orderBy(asc(events.sortOrder));

    displayEvents = visibleEventRows.map((row) => row.event);
  }

  return (
    <div className="font-roboto flex min-h-screen flex-col items-center justify-start bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-4 sm:justify-center sm:p-8">
      <div className="w-full max-w-3xl">
        <h1
          className={`${marcellus.className} mb-4 text-center text-5xl font-bold text-[#9e3f3f] sm:text-6xl`}
        >
          Schedule
        </h1>

        <p className="mb-12 text-center text-xl text-[#6a5555]">
          Welcome, {welcomeName}! Here&apos;s your personalized schedule.
        </p>

        <div className="mb-12 space-y-6">
          {displayEvents.length === 0 ? (
            <p className="text-center text-[#6a5555]">
              No events have been added to your schedule yet.
            </p>
          ) : (
            displayEvents.map((item) => (
              <ScheduleCard
                key={item.id}
                item={item}
                isCurrentEvent={isCurrentEvent(item)}
              />
            ))
          )}
        </div>

        <div className="text-center">
          <Button href="/">Back Home</Button>
        </div>
      </div>
    </div>
  );
}
