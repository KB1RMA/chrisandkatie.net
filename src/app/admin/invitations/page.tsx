import { Marcellus } from 'next/font/google';
import type { Metadata } from 'next';
import { asc } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { events } from '@/lib/db/schema';
import type { MealOption } from '@/lib/constants';
import { AdminTabs } from '@/components/admin/AdminTabs';
import {
  InvitationTable,
  type AvailableEvent,
  type InvitationTableRow,
} from '@/components/admin/InvitationTable';

export const dynamic = 'force-dynamic';

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
});

export const metadata: Metadata = {
  title: 'Invitations',
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
  const db = getDb();

  // Fetch all available events ordered for display
  const availableEvents: AvailableEvent[] = await db
    .select({ id: events.id, name: events.name, sortOrder: events.sortOrder })
    .from(events)
    .orderBy(asc(events.sortOrder));

  const invitations = await db.query.invitations.findMany({
    with: {
      guests: {
        with: {
          guestEvents: true,
        },
      },
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

    // Compute unique event IDs granted to any guest on this invitation
    const initialVisibleEventIds = [
      ...new Set(
        invitation.guests.flatMap((guest) =>
          guest.guestEvents.map((ge) => ge.eventId),
        ),
      ),
    ];

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
      availableEvents,
      initialVisibleEventIds,
      searchText,
      invitationCode: invitation.invitationCode ?? null,
      mailingAddress: invitation.mailingAddress ?? null,
      address: invitation.address ?? null,
      addressLine2: invitation.addressLine2 ?? null,
      city: invitation.city ?? null,
      state: invitation.state ?? null,
      zipCode: invitation.zipCode ?? null,
      country: invitation.country ?? null,
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
    <div className="font-roboto flex min-h-screen flex-col items-center justify-start bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-4 sm:justify-center sm:p-8">
      <div className="w-full max-w-6xl">
        <h1
          className={`${marcellus.className} mb-4 text-center text-4xl font-bold text-[#9e3f3f] sm:text-5xl`}
        >
          Invitations Admin
        </h1>
        <AdminTabs />
        <p className="mt-6 mb-4 text-center text-lg text-[#6a5555]">
          Review RSVP status and expand invitations to see guest details.
        </p>

        {/* Summary Statistics */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border-l-4 border-[#9e3f3f] bg-[#fffdfb] p-4 shadow">
            <p className="text-sm font-medium text-[#7a6666]">
              Total Invitations
            </p>
            <p className="text-2xl font-bold text-[#9e3f3f]">
              {totalInvitations}
            </p>
          </div>
          <div className="rounded-lg border-l-4 border-green-500 bg-[#fffdfb] p-4 shadow">
            <p className="text-sm font-medium text-[#7a6666]">Submitted</p>
            <p className="text-2xl font-bold text-green-700">
              {submittedInvitations}
            </p>
          </div>
          <div className="rounded-lg border-l-4 border-yellow-500 bg-[#fffdfb] p-4 shadow">
            <p className="text-sm font-medium text-[#7a6666]">Pending</p>
            <p className="text-2xl font-bold text-yellow-700">
              {pendingInvitations}
            </p>
          </div>
          <div className="rounded-lg border-l-4 border-blue-500 bg-[#fffdfb] p-4 shadow">
            <p className="text-sm font-medium text-[#7a6666]">Total Guests</p>
            <p className="text-2xl font-bold text-blue-700">{totalGuests}</p>
          </div>
          <div className="rounded-lg border-l-4 border-green-600 bg-[#fffdfb] p-4 shadow">
            <p className="text-sm font-medium text-[#7a6666]">Attending</p>
            <p className="text-2xl font-bold text-green-800">
              {totalAttending}
            </p>
          </div>
          <div className="rounded-lg border-l-4 border-red-500 bg-[#fffdfb] p-4 shadow">
            <p className="text-sm font-medium text-[#7a6666]">Declined</p>
            <p className="text-2xl font-bold text-red-700">{totalDeclined}</p>
          </div>
          <div className="rounded-lg border-l-4 border-gray-400 bg-[#fffdfb] p-4 shadow">
            <p className="text-sm font-medium text-[#7a6666]">Not Responded</p>
            <p className="text-2xl font-bold text-gray-700">{totalPending}</p>
          </div>
          <div className="rounded-lg border-l-4 border-[#b76565] bg-[#fffdfb] p-4 shadow">
            <p className="text-sm font-medium text-[#7a6666]">Response Rate</p>
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

        <div className="rounded-lg bg-[#fffdfb] p-6 shadow-lg">
          <InvitationTable data={rows} />
        </div>
      </div>
    </div>
  );
}
