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
  title: 'Guests',
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
        dietaryRestrictions: guest.dietaryRestrictions,
        notes: guest.notes,
        searchText,
      };
    });
  });

  // Calculate summary statistics
  const totalGuests = rows.length;
  const submittedGuests = rows.filter((r) => r.status === 'submitted').length;
  const attendingGuests = rows.filter((r) => r.attending === true).length;
  const decliningGuests = rows.filter((r) => r.attending === false).length;
  const notRespondedGuests = rows.filter((r) => r.attending === null).length;

  return (
    <div className="font-roboto flex min-h-screen flex-col items-center justify-start bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-4 sm:justify-center sm:p-8">
      <div className="w-full max-w-6xl">
        <h1
          className={`${marcellus.className} mb-4 text-center text-4xl font-bold text-[#9e3f3f] sm:text-5xl`}
        >
          Guests Admin
        </h1>
        <AdminTabs />
        <p className="mt-6 mb-4 text-center text-lg text-[#6a5555]">
          Browse individual guest responses and RSVP details.
        </p>

        {/* Summary Statistics */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border-l-4 border-[#9e3f3f] bg-[#fffdfb] p-4 shadow">
            <p className="text-sm font-medium text-[#7a6666]">Total Guests</p>
            <p className="text-2xl font-bold text-[#9e3f3f]">{totalGuests}</p>
          </div>
          <div className="rounded-lg border-l-4 border-green-500 bg-[#fffdfb] p-4 shadow">
            <p className="text-sm font-medium text-[#7a6666]">Submitted</p>
            <p className="text-2xl font-bold text-green-700">
              {submittedGuests}
            </p>
          </div>
          <div className="rounded-lg border-l-4 border-green-600 bg-[#fffdfb] p-4 shadow">
            <p className="text-sm font-medium text-[#7a6666]">Attending</p>
            <p className="text-2xl font-bold text-green-800">
              {attendingGuests}
            </p>
          </div>
          <div className="rounded-lg border-l-4 border-red-500 bg-[#fffdfb] p-4 shadow">
            <p className="text-sm font-medium text-[#7a6666]">Declining</p>
            <p className="text-2xl font-bold text-red-700">{decliningGuests}</p>
          </div>
          <div className="rounded-lg border-l-4 border-yellow-500 bg-[#fffdfb] p-4 shadow">
            <p className="text-sm font-medium text-[#7a6666]">Not Responded</p>
            <p className="text-2xl font-bold text-yellow-700">
              {notRespondedGuests}
            </p>
          </div>
          <div className="rounded-lg border-l-4 border-[#b76565] bg-[#fffdfb] p-4 shadow">
            <p className="text-sm font-medium text-[#7a6666]">Response Rate</p>
            <p className="text-2xl font-bold text-[#9e3f3f]">
              {totalGuests > 0
                ? Math.round(
                    ((attendingGuests + decliningGuests) / totalGuests) * 100,
                  )
                : 0}
              %
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-[#fffdfb] p-6 shadow-lg">
          <GuestTable data={rows} />
        </div>
      </div>
    </div>
  );
}
