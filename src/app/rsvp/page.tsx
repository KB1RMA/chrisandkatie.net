import { Marcellus } from 'next/font/google';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { RSVPForm, type GuestRSVP } from '@/components/RSVPForm';
import { WEDDING_DATE_DISPLAY, type MealOption } from '@/lib/constants';

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
});

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'RSVP - Chris & Katie',
  description: `RSVP for Chris and Katie's celebration on ${WEDDING_DATE_DISPLAY}`,
};

/**
 * RSVP page for guests to respond to invitation.
 *
 * Protected route - shows invitation details and allows RSVP for all guests.
 */
export default async function RSVPPage() {
  // Check authentication
  const session = await auth();

  if (!session?.user?.guestId) {
    redirect('/login?callbackUrl=/rsvp');
  }

  // Get logged-in guest with invitation and all guests on invitation
  const db = getDb();
  const guestId = session.user.guestId as string;
  const loggedInGuest = await db.query.guests.findFirst({
    where: (table, { eq }) => eq(table.id, guestId),
    with: {
      invitation: {
        with: {
          guests: true,
        },
      },
    },
  });

  if (!loggedInGuest || !loggedInGuest.invitation) {
    redirect('/login?callbackUrl=/rsvp');
  }

  const { invitation } = loggedInGuest;

  // Format guests for form
  const guestsForForm: GuestRSVP[] = invitation.guests.map((g) => ({
    id: g.id,
    firstName: g.firstName,
    lastName: g.lastName,
    type: g.type as 'adult' | 'child',
    attending: g.attending,
    mealChoice: g.mealChoice as MealOption | null,
    dietaryRestrictions: g.dietaryRestrictions,
    notes: g.notes,
  }));

  // Check if RSVP has been submitted (all guests have a response)
  const isSubmitted = guestsForForm.every((g) => g.attending !== null);
  const submittedBy = `${loggedInGuest.firstName} ${loggedInGuest.lastName}`;
  const submittedAt = loggedInGuest.updatedAt;

  return (
    <div className="font-roboto flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-4 sm:p-8">
      <div className="w-full max-w-3xl">
        <h1
          className={`${marcellus.className} text-5xl sm:text-6xl font-bold text-[#9e3f3f] mb-4 text-center`}
        >
          RSVP
        </h1>

        <p className="text-lg sm:text-xl text-[#6a5555] mb-6 sm:mb-8 text-center px-2">
          We can&#39;t wait to celebrate with you! Please let us know if
          you&#39;ll be joining us on {WEDDING_DATE_DISPLAY}.
        </p>

        <div className="bg-[#fffdfb] rounded-lg shadow-lg p-4 sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-medium text-[#9e3f3f] mb-2">
              Your Invitation
            </h2>
            <div className="text-sm text-gray-600 space-y-0">
              {invitation.mailingAddress && (
                <p className="font-medium">{invitation.mailingAddress}</p>
              )}
              {invitation.address && <p>{invitation.address}</p>}
              {invitation.addressLine2 && <p>{invitation.addressLine2}</p>}
              {invitation.city && invitation.state && (
                <p>
                  {invitation.city}, {invitation.state} {invitation.zipCode}
                </p>
              )}
              <p className="text-xs text-gray-500 pt-3">
                {invitation.guests.length}{' '}
                {invitation.guests.length === 1 ? 'guest' : 'guests'} invited
              </p>
            </div>
          </div>

          <RSVPForm
            invitationId={invitation.id}
            guests={guestsForForm}
            isSubmitted={isSubmitted}
            submittedBy={submittedBy}
            submittedAt={submittedAt}
          />
        </div>
      </div>
    </div>
  );
}
