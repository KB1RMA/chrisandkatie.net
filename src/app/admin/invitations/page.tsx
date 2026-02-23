import { Marcellus } from 'next/font/google';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import type { MealOption } from '@/lib/constants';
import { AdminTabs } from '@/components/admin/AdminTabs';
import {
  InvitationTable,
  type InvitationTableRow,
} from '@/components/admin/InvitationTable';

export const dynamic = 'force-dynamic';

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
});

export const metadata: Metadata = {
  title: 'Invitation Admin - Chris & Katie',
  description: 'Admin view of invitations and RSVP status.',
};

const formatGuestName = (firstName: string, lastName: string) => {
  const nameParts = [firstName, lastName].filter(Boolean);

  if (nameParts.length === 0) {
    return 'Guest';
  }

  return nameParts.join(' ');
};

/**
 * Admin page showing invitations and RSVP status.
 *
 * Protected route - requires authentication.
 *
 * @returns Admin invitations page.
 * @throws {Error} Redirects when user is unauthenticated.
 */
export default async function AdminInvitationsPage() {
  const session = await auth();

  if (!session?.user?.guestId) {
    redirect('/login?callbackUrl=/admin/invitations');
  }

  const db = getDb();
  const invitations = await db.query.invitations.findMany({
    with: {
      guests: true,
    },
  });

  const rows: InvitationTableRow[] = invitations.map((invitation) => {
    const guestNames = invitation.guests
      .map((guest) => formatGuestName(guest.firstName, guest.lastName))
      .join(' ');
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
    const totalInvited = invitation.totalInvited || invitation.guests.length;
    const searchText = `${invitationName} ${relationshipToCouple} ${guestNames}`
      .toLowerCase()
      .trim();
    const visibleEvents = JSON.parse(invitation.visibleEvents) as number[];

    return {
      id: invitation.id,
      invitationName,
      relationshipToCouple,
      totalInvited,
      status,
      attendingCount,
      declinedCount,
      pendingCount,
      guests: invitation.guests.map((guest) => ({
        id: guest.id,
        firstName: guest.firstName,
        lastName: guest.lastName,
        type: guest.type as 'adult' | 'child',
        attending: guest.attending,
        mealChoice: guest.mealChoice as MealOption | null,
        dietaryRestrictions: guest.dietaryRestrictions,
        notes: guest.notes,
      })),
      visibleEvents,
      searchText,
    };
  });

  // Calculate summary statistics
  const totalInvitations = rows.length;
  const submittedInvitations = rows.filter(
    (r) => r.status === 'submitted',
  ).length;
  const pendingInvitations = rows.filter((r) => r.status === 'pending').length;
  const totalGuests = rows.reduce((sum, r) => sum + r.totalInvited, 0);
  const totalAttending = rows.reduce((sum, r) => sum + r.attendingCount, 0);
  const totalDeclined = rows.reduce((sum, r) => sum + r.declinedCount, 0);
  const totalPending = rows.reduce((sum, r) => sum + r.pendingCount, 0);

  return (
    <div className="font-roboto flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-8">
      <div className="w-full max-w-6xl">
        <h1
          className={`${marcellus.className} text-4xl sm:text-5xl font-bold text-[#9e3f3f] mb-4 text-center`}
        >
          Invitations Admin
        </h1>
        <AdminTabs />
        <p className="text-lg text-[#6a5555] mb-4 text-center mt-6">
          Review RSVP status and expand invitations to see guest details.
        </p>
        
        {/* Summary Statistics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#fffdfb] rounded-lg shadow p-4 border-l-4 border-[#9e3f3f]">
            <p className="text-sm text-[#7a6666] font-medium">
              Total Invitations
            </p>
            <p className="text-2xl font-bold text-[#9e3f3f]">
              {totalInvitations}
            </p>
          </div>
          <div className="bg-[#fffdfb] rounded-lg shadow p-4 border-l-4 border-green-500">
            <p className="text-sm text-[#7a6666] font-medium">Submitted</p>
            <p className="text-2xl font-bold text-green-700">
              {submittedInvitations}
            </p>
          </div>
          <div className="bg-[#fffdfb] rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <p className="text-sm text-[#7a6666] font-medium">Pending</p>
            <p className="text-2xl font-bold text-yellow-700">
              {pendingInvitations}
            </p>
          </div>
          <div className="bg-[#fffdfb] rounded-lg shadow p-4 border-l-4 border-blue-500">
            <p className="text-sm text-[#7a6666] font-medium">Total Guests</p>
            <p className="text-2xl font-bold text-blue-700">{totalGuests}</p>
          </div>
          <div className="bg-[#fffdfb] rounded-lg shadow p-4 border-l-4 border-green-600">
            <p className="text-sm text-[#7a6666] font-medium">Attending</p>
            <p className="text-2xl font-bold text-green-800">
              {totalAttending}
            </p>
          </div>
          <div className="bg-[#fffdfb] rounded-lg shadow p-4 border-l-4 border-red-500">
            <p className="text-sm text-[#7a6666] font-medium">Declined</p>
            <p className="text-2xl font-bold text-red-700">{totalDeclined}</p>
          </div>
          <div className="bg-[#fffdfb] rounded-lg shadow p-4 border-l-4 border-gray-400">
            <p className="text-sm text-[#7a6666] font-medium">Not Responded</p>
            <p className="text-2xl font-bold text-gray-700">{totalPending}</p>
          </div>
          <div className="bg-[#fffdfb] rounded-lg shadow p-4 border-l-4 border-[#b76565]">
            <p className="text-sm text-[#7a6666] font-medium">Response Rate</p>
            <p className="text-2xl font-bold text-[#9e3f3f]">
              {totalGuests > 0
                ? Math.round(
                    ((totalAttending + totalDeclined) / totalGuests) * 100,
                  )
                : 0}
              %
            </p>
          </div>
        </div>

        <div className="bg-[#fffdfb] rounded-lg shadow-lg p-6">
          <InvitationTable data={rows} />
        </div>
      </div>
    </div>
  );
}
