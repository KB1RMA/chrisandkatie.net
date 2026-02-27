import { Marcellus } from 'next/font/google';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth, isGuestAuthenticated } from '@/lib/auth';
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
 * Supports two authentication paths:
 * - Invitation code flow: session.user.invitationId (new)
 * - Name-based flow: session.user.guestId (legacy)
 *
 * Protected route — redirects unauthenticated requests to /login.
 */
export default async function RSVPPage() {
  // Check authentication
  const session = await auth();

  const hasGuestSession = !!session?.user?.guestId;
  const hasInvitationSession = !!session?.user?.invitationId;

  if (!isGuestAuthenticated(session)) {
    redirect('/login?callbackUrl=/rsvp');
  }

  const db = getDb();

  // Load invitation with guests via whichever auth path was used
  const loadInvitationWithGuests = async () => {
    if (hasInvitationSession) {
      const invitationId = session.user.invitationId as string;

      return db.query.invitations.findFirst({
        where: (table, { eq }) => eq(table.id, invitationId),
        with: { guests: true },
      });
    }

    const guestId = session.user.guestId as string;
    const loggedInGuest = await db.query.guests.findFirst({
      where: (table, { eq }) => eq(table.id, guestId),
      with: {
        invitation: {
          with: { guests: true },
        },
      },
    });

    return loggedInGuest?.invitation ?? undefined;
  };

  const invitation = await loadInvitationWithGuests();

  if (!invitation) {
    redirect('/login?callbackUrl=/rsvp');
  }

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
  const submittedAt = invitation.updatedAt;

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
            submittedAt={submittedAt}
            contactEmail={invitation.contactEmail}
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
