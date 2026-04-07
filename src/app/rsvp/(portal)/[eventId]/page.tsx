import { redirect } from 'next/navigation';
import { Marcellus } from 'next/font/google';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { retrieveEventRsvp } from '@/app/rsvp/(portal)/[eventId]/actions';
import { EventRsvpForm } from '@/components/EventRsvpForm';

export const dynamic = 'force-dynamic';

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
});

type EventRsvpPageProps = {
  params: Promise<{ eventId: string }>;
};

export async function generateMetadata({
  params,
}: EventRsvpPageProps): Promise<Metadata> {
  return {
    title: 'Event RSVP',
    description: `RSVP for an event at Katie and Chris's celebration`,
  };

  // Silence unused variable warning while keeping the pattern
  void params;
}

/**
 * Page for submitting or updating RSVP for a specific additional event.
 *
 * Displays event details and the RSVP form with pre-populated data
 * if the guest has already responded.
 *
 * @param params - URL params containing eventId.
 */
export default async function EventRsvpPage({ params }: EventRsvpPageProps) {
  const session = await auth();

  if (!session?.user?.invitationId) {
    redirect('/login?callbackUrl=/rsvp');
  }

  const { eventId } = await params;

  let result;

  try {
    result = await retrieveEventRsvp(eventId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'Unauthorized' || message === 'Not invited to this event') {
      redirect('/rsvp');
    }

    throw error;
  }

  const { event, rsvp, attendees, invitationGuests, deadlinePassed } = result;

  return (
    <div className="font-roboto flex min-h-screen flex-col items-center justify-start bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-4 sm:justify-center sm:p-8">
      <div className="w-full max-w-2xl">
        <h1
          className={`${marcellus.className} mb-2 text-center text-4xl font-bold text-[#9e3f3f] sm:text-5xl`}
        >
          {event.name}
        </h1>

        <div className="mb-6 space-y-1 text-center text-gray-600">
          <p>
            {new Date(`${event.eventDate}T00:00:00`).toLocaleDateString(
              'en-US',
              {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              },
            )}
          </p>
          {event.location && <p>{event.location}</p>}
          {event.description && (
            <p className="mt-2 text-sm">{event.description}</p>
          )}
          {event.dressCode && (
            <p className="mt-1 text-sm">
              <span className="font-medium">Dress code:</span> {event.dressCode}
            </p>
          )}
        </div>

        <div className="rounded-lg bg-[#fffdfb] p-4 shadow-lg sm:p-8">
          <EventRsvpForm
            eventId={event.id}
            guestId={result.guestId}
            invitationGuests={invitationGuests}
            existingRsvp={
              rsvp
                ? {
                    attendanceStatus: rsvp.attendanceStatus,
                    specialRequests: rsvp.specialRequests,
                    attendees,
                  }
                : null
            }
            deadlinePassed={deadlinePassed}
            eventName={event.name}
          />
        </div>
      </div>
    </div>
  );
}
