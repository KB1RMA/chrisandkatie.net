import { Marcellus } from 'next/font/google';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import type { MealOption } from '@/lib/constants';
import { AdminTabs } from '@/components/admin/AdminTabs';
import { GuestTable, type GuestTableRow } from '@/components/admin/GuestTable';

export const dynamic = 'force-dynamic';

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
});

export const metadata: Metadata = {
  title: 'Guest Admin - Chris & Katie',
  description: 'Admin view of individual guests and RSVP status.',
};

const formatGuestName = (firstName: string, lastName: string) => {
  const nameParts = [firstName, lastName].filter(Boolean);

  if (nameParts.length === 0) {
    return 'Guest';
  }

  return nameParts.join(' ');
};

/**
 * Admin page showing individual guest RSVP status.
 *
 * Protected route - requires authentication.
 *
 * @returns Admin guest page.
 * @throws {Error} Redirects when user is unauthenticated.
 */
export default async function AdminGuestsPage() {
  const session = await auth();

  if (!session?.user?.guestId) {
    redirect('/login?callbackUrl=/admin/guests');
  }

  const db = getDb();
  const invitations = await db.query.invitations.findMany({
    with: {
      guests: true,
    },
  });

  const rows: GuestTableRow[] = invitations.flatMap((invitation) => {
    const primaryGuest = invitation.guests[0];
    const fallbackName = primaryGuest
      ? formatGuestName(primaryGuest.firstName, primaryGuest.lastName)
      : 'Invitation';
    const invitationName =
      invitation.mailingAddress?.trim() || fallbackName || 'Invitation';
    const attendingCount = invitation.guests.filter(
      (guest) => guest.attending === true,
    ).length;
    const declinedCount = invitation.guests.filter(
      (guest) => guest.attending === false,
    ).length;
    const pendingCount = invitation.guests.filter(
      (guest) => guest.attending === null,
    ).length;
    const status = pendingCount === 0 ? 'submitted' : 'pending';
    const relationshipToCouple = invitation.relationshipToCouple || 'Unknown';

    return invitation.guests.map((guest) => {
      const fullName = formatGuestName(guest.firstName, guest.lastName);
      const searchText = `${fullName} ${invitationName} ${relationshipToCouple}`
        .toLowerCase()
        .trim();

      return {
        id: guest.id,
        fullName,
        invitationName,
        relationshipToCouple,
        type: guest.type as 'adult' | 'child',
        status,
        attending: guest.attending,
        mealChoice: guest.mealChoice as MealOption | null,
        notes: guest.notes,
        searchText,
      };
    });
  });

  return (
    <div className="font-roboto flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-8">
      <div className="w-full max-w-6xl">
        <h1
          className={`${marcellus.className} text-4xl sm:text-5xl font-bold text-[#9e3f3f] mb-4 text-center`}
        >
          Guests Admin
        </h1>
        <AdminTabs />
        <p className="text-lg text-[#6a5555] mb-8 text-center mt-6">
          Browse individual guest responses and RSVP details.
        </p>
        <div className="bg-[#fffdfb] rounded-lg shadow-lg p-6">
          <GuestTable data={rows} />
        </div>
      </div>
    </div>
  );
}
