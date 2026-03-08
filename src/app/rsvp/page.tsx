import { Marcellus } from 'next/font/google';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth, getAuthIdentity } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { RSVPWizard, type InvitationAddress } from '@/components/RSVPWizard';
import { WEDDING_DATE_DISPLAY, type MealOption } from '@/lib/constants';
import { fetchGuestEvents } from '@/app/rsvp/actions';
import type { GuestRSVP } from '@/components/RSVPForm';

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
});

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'RSVP',
  description: `RSVP for Katie and Chris's celebration on ${WEDDING_DATE_DISPLAY}`,
};

/**
 * RSVP page for guests to respond to invitation.
 *
 * Authenticated via invitation code — identity is guaranteed to be a guest
 * by the rsvp/layout.tsx wrapper. Loads invitation and guest records using
 * the invitationId from the session identity.
 *
 * Protected route — redirects unauthenticated requests to /login.
 */
export default async function RSVPPage() {
  const session = await auth();
  const identity = getAuthIdentity(session);

  // Redirect if not a guest (layout should have already handled this)
  if (identity?.type !== 'guest') {
    redirect('/login?callbackUrl=/rsvp');
  }

  const db = getDb();

  const invitation = await db.query.invitations.findFirst({
    where: (table, { eq }) => eq(table.id, identity.invitationId),
    with: { guests: true },
  });

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
    additionalEvents = await fetchGuestEvents();
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
          <RSVPWizard
            invitationId={invitation.id}
            address={
              {
                mailingAddress: invitation.mailingAddress,
                address: invitation.address,
                addressLine2: invitation.addressLine2,
                city: invitation.city,
                state: invitation.state,
                zipCode: invitation.zipCode,
              } satisfies InvitationAddress
            }
            guests={guestsForForm}
            isSubmitted={isSubmitted}
            submittedAt={submittedAt}
            contactEmail={invitation.contactEmail}
            additionalEvents={additionalEvents}
          />
        </div>
      </div>
    </div>
  );
}
