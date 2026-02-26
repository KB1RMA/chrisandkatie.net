import { Marcellus } from 'next/font/google';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { RSVPForm, type GuestRSVP } from '@/components/RSVPForm';
import { EventRsvpCard } from '@/components/EventRsvpCard';
import { WEDDING_DATE_DISPLAY, type MealOption } from '@/lib/constants';
import { fetchGuestEvents } from '@/app/rsvp/actions';

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
});

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'RSVP',
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

  // Fetch additional events guest is invited to (excluding main wedding type)
  let additionalEvents: Awaited<ReturnType<typeof fetchGuestEvents>> = [];

  try {
    const allGuestEvents = await fetchGuestEvents();
    additionalEvents = allGuestEvents.filter(
      ({ event }) => event.type !== 'main',
    );
  } catch {
    // Non-critical: continue without additional events if query fails
  }

  return (
    <div className="font-roboto flex min-h-screen flex-col items-center justify-start bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-4 sm:justify-center sm:p-8">
      <div className="w-full max-w-3xl">
        <h1
          className={`${marcellus.className} mb-4 text-center text-5xl font-bold text-[#9e3f3f] sm:text-6xl`}
        >
          RSVP
        </h1>

        <p className="mb-6 px-2 text-center text-lg text-[#6a5555] sm:mb-8 sm:text-xl">
          We can&#39;t wait to celebrate with you! Please let us know if
          you&#39;ll be joining us on {WEDDING_DATE_DISPLAY}.
        </p>

        <div className="rounded-lg bg-[#fffdfb] p-4 shadow-lg sm:p-8">
          <div className="mb-6">
            <h2 className="mb-2 text-2xl font-medium text-[#9e3f3f]">
              Your Invitation
            </h2>
            <div className="space-y-0 text-sm text-gray-600">
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
              <p className="pt-3 text-xs text-gray-500">
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

        {/* Additional events section */}
        {additionalEvents.length > 0 && (
          <div className="mt-6">
            <h2
              className={`${marcellus.className} mb-4 text-2xl font-bold text-[#9e3f3f]`}
            >
              Additional Events
            </h2>
            <div className="space-y-3">
              {additionalEvents.map(({ event, rsvp }) => (
                <EventRsvpCard key={event.id} event={event} rsvp={rsvp} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
