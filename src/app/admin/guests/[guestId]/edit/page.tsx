import { Marcellus } from 'next/font/google';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { guests } from '@/lib/db/schema';
import { AdminTabs } from '@/components/admin/AdminTabs';
import { GuestRsvpDetail } from '@/components/admin/GuestRsvpDetail';

export const dynamic = 'force-dynamic';

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
});

export const metadata: Metadata = {
  title: 'Edit Guest RSVP',
  description: 'Admin RSVP edit page for an individual guest.',
};

/**
 * Admin RSVP edit page for a specific guest.
 *
 * Fetches the guest with full RSVP and event relations then renders the
 * inline GuestRsvpDetail editor. No deadline check applies — admins can
 * update any RSVP at any time.
 *
 * Protected route — requires admin role.
 *
 * @param props - Next.js page props with guestId route param.
 * @returns Admin RSVP edit page.
 * @throws {Error} Redirects when user lacks admin role; 404 when guest not found.
 */
export default async function AdminGuestEditPage({
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

  return (
    <div className="font-roboto flex min-h-screen flex-col items-center justify-start bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-4 sm:justify-center sm:p-8">
      <div className="w-full max-w-4xl">
        <h1
          className={`${marcellus.className} mb-4 text-center text-4xl font-bold text-[#9e3f3f] sm:text-5xl`}
        >
          Edit RSVPs — {guestName}
        </h1>
        <AdminTabs />

        <div className="mt-6 flex items-center justify-between">
          <Link
            href={`/admin/guests/${guestId}`}
            className="text-sm text-[#9e3f3f] underline hover:text-[#7a3030]"
          >
            ← Back to guest detail
          </Link>
        </div>

        <GuestRsvpDetail
          guestId={guestId}
          guestEvents={guest.guestEvents}
          rsvpResponses={guest.rsvpResponses}
        />
      </div>
    </div>
  );
}
