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
        notes: guest.notes,
      })),
      searchText,
    };
  });

  return (
    <div className="font-roboto flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-8">
      <div className="w-full max-w-6xl">
        <h1
          className={`${marcellus.className} text-4xl sm:text-5xl font-bold text-[#9e3f3f] mb-4 text-center`}
        >
          Invitations Admin
        </h1>
        <AdminTabs />
        <p className="text-lg text-[#6a5555] mb-8 text-center mt-6">
          Review RSVP status and expand invitations to see guest details.
        </p>
        <div className="bg-[#fffdfb] rounded-lg shadow-lg p-6">
          <InvitationTable data={rows} />
        </div>
      </div>
    </div>
  );
}
