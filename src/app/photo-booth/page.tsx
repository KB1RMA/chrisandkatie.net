import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, getAuthIdentity } from '@/lib/auth';
import {
  findAllEvents,
  findEventsByInvitationId,
} from '@/lib/db/repositories/events';
import type { WeddingEvent } from '@/lib/db/schema';

export const metadata: Metadata = {
  title: 'Photo Booth',
};

/** Formats an ISO date string (YYYY-MM-DD) to a readable date. */
function formatEventDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Photo booth landing page — lists the events visible to the current user.
 *
 * Admins see all events. Guests see only events linked to their invitation.
 *
 * @returns The event selection page.
 */
export default async function PhotoBoothPage() {
  const session = await auth();
  const identity = getAuthIdentity(session);

  if (!identity) {
    redirect('/login?callbackUrl=/photo-booth');
  }

  let visibleEvents: WeddingEvent[];

  if (identity.type === 'admin') {
    visibleEvents = await findAllEvents();
  } else {
    visibleEvents = await findEventsByInvitationId(identity.invitationId);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#fff7f4] to-[#f3dedb]">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="mb-2 text-center text-3xl font-bold text-[#9e3f3f]">
          Photo Booth
        </h1>
        <p className="mb-10 text-center text-[#6a5555]">
          Choose an event to take photos and browse the album.
        </p>
        <ul className="flex flex-col gap-4">
          {visibleEvents.map((event) => (
            <li key={event.id}>
              <Link
                href={`/photo-booth/${event.id}`}
                className="flex flex-col gap-1 rounded-2xl bg-white px-6 py-5 shadow-md transition hover:shadow-lg"
              >
                <span className="text-lg font-semibold text-[#9e3f3f]">
                  {event.name}
                </span>
                <span className="text-sm text-[#6a5555]">
                  {formatEventDate(event.eventDate)}
                  {event.startTime && ` · ${event.startTime}`}
                </span>
                {event.location && (
                  <span className="text-sm text-stone-500">
                    {event.location}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
