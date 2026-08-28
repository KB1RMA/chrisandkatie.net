'use server';

/**
 * Server actions for admin overrides of event RSVPs.
 *
 * RSVPs are stored per party (invitation), not per person: one response row
 * carries the party-level status and one attendee row is written per attending
 * person. An admin edit therefore rewrites the whole party's RSVP for the
 * event, exactly as a guest submission does, so the two never disagree.
 */
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { auth, getAuthIdentity } from '@/lib/auth';
import { createLogger } from '@/lib/logger';
import { buildPartyEventRsvpWrite, normalizeName } from '@/lib/rsvp';
import { setPartyEventRsvpSchema } from '@/lib/schemas/rsvp';
import type { SetPartyEventRsvpInput } from '@/lib/schemas/rsvp';
import * as EventRepository from '@/lib/db/repositories/events';
import * as GuestRepository from '@/lib/db/repositories/guests';
import * as GuestEventRepository from '@/lib/db/repositories/guestEvents';
import * as RsvpRepository from '@/lib/db/repositories/rsvpResponses';

const logger = createLogger('admin-event-rsvps');

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Ensure the current session belongs to an admin.
 *
 * @throws {Error} 'Unauthorized' when session lacks admin role.
 */
async function requireAdmin(): Promise<void> {
  const identity = getAuthIdentity(await auth());

  if (!identity || identity.type !== 'admin') {
    throw new Error('Unauthorized');
  }
}

/**
 * Extract the first validation issue message from a failed Zod parse.
 *
 * @param error - The ZodError from a failed safeParse.
 * @returns The first issue message, or a generic fallback.
 */
function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? 'Invalid input';
}

/**
 * Check that two id collections contain exactly the same members.
 *
 * @param submitted - Guest ids named by the caller.
 * @param expected - Guest ids the party actually has at this event.
 * @returns True when both collections hold the same ids.
 */
function sameMembership(submitted: string[], expected: string[]): boolean {
  const submittedIds = new Set(submitted);

  return (
    submittedIds.size === submitted.length &&
    submittedIds.size === expected.length &&
    expected.every((id) => submittedIds.has(id))
  );
}

/**
 * Set attendance for every member of a party at a single event.
 *
 * The caller submits a status for each party member invited to the event; the
 * action rewrites the party's response and attendee rows to match. Because the
 * admin RSVP table reconstructs per-person status from those attendee rows,
 * this is what makes an override visible on the RSVP page, the CSV export, the
 * meal breakdown, and the seating chart alike.
 *
 * Writing the whole party is deliberate. Creating a party's first response row
 * moves every member of that party off `no_response`, so the statuses of the
 * people who were not edited must be stated explicitly rather than inferred.
 *
 * Rejected for the main event: its guest-facing RSVP wizard never reads or
 * writes RsvpResponse rows, so an override written here would be invisible to
 * guests and could never be corrected by a later guest submission.
 *
 * @param input - Event id, the guest whose row was edited, a status per party member, and the party's last-seen updatedAt.
 * @returns { success: true } on success, or { success: false; error } if invalid.
 * @throws {Error} 'Unauthorized' when session lacks admin role.
 */
export async function setPartyEventRsvp(
  input: SetPartyEventRsvpInput,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = setPartyEventRsvpSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: firstIssue(parsed.error) };
  }

  const { eventId, guestId, statuses, expectedUpdatedAt } = parsed.data;

  const event = await EventRepository.findEventById(eventId);

  if (!event) {
    return { success: false, error: 'Event not found.' };
  }

  // The main event's guest-facing RSVP wizard writes only the legacy
  // Guest.attending/mealChoice columns and never reads or writes RsvpResponse
  // rows (its guest-facing per-event page is unreachable for the main event —
  // rsvpRequired is never enabled for it). Writing a RsvpResponse row here for
  // the main event would create a second, unsynced record of the party's
  // intent that no guest-facing flow can see or ever overwrite back. Checked
  // before the guest lookup so a main-event request never touches guest data.
  if (event.type === 'main') {
    return {
      success: false,
      error:
        'Main event attendance is managed through the RSVP wizard and cannot be edited here.',
    };
  }

  const guest = await GuestRepository.findGuestById(guestId);

  if (!guest) {
    return { success: false, error: 'Guest not found.' };
  }

  // Read the event's guest list through the same query the guest-facing RSVP
  // page uses, so a response this action creates is owned by the same party
  // member that page would pick. Owning it with anyone else risks the guest
  // later submitting onto a second, parallel row for the same party.
  const eventGuestRows =
    await GuestEventRepository.findGuestEventsForEvent(eventId);

  // Party members invited to this event, in that same order.
  const members = eventGuestRows
    .filter((row) => row.guest.invitationId === guest.invitationId)
    .map((row) => ({
      guestId: row.guest.id,
      firstName: row.guest.firstName,
      lastName: row.guest.lastName,
    }));

  if (!members.some((member) => member.guestId === guestId)) {
    return { success: false, error: 'Guest is not invited to this event.' };
  }

  // The submitted list must cover exactly this party — it is what stops an
  // override from reaching a guest outside the party or one not invited here.
  if (
    !sameMembership(
      statuses.map((status) => status.guestId),
      members.map((member) => member.guestId),
    )
  ) {
    return {
      success: false,
      error: 'The submitted guest list does not match this party.',
    };
  }

  const partyResponses = await RsvpRepository.findEventResponsesForGuestIds(
    eventId,
    members.map((member) => member.guestId),
  );

  // The editor writes a status for every party member, so a save built from a
  // stale page would revert whatever changed in the meantime — including a
  // guest's own submission. Reject rather than overwrite.
  const currentUpdatedAt = partyResponses.reduce<string | null>(
    (latest, response) =>
      !latest || response.updatedAt > latest ? response.updatedAt : latest,
    null,
  );

  if (currentUpdatedAt !== expectedUpdatedAt) {
    return {
      success: false,
      error:
        "This party's RSVP changed since this page was loaded. Refresh and try again.",
    };
  }

  // Reuse the party's existing response row — specifically the one owned by
  // members[0], the same member the guest-facing page's own lookup
  // (findGuestEventsForEvent, unordered) would pick when it later reads or
  // writes this party's RSVP. A party can end up with two response rows (see
  // staleAttendeeIds below); if the edited guestId owns the *other* row, the
  // guest page would read stale attendees post-edit and duplicate them on its
  // next submission. Falling back to guestId's own row, then any row, only
  // matters for a two-row party — normally members[0] owns the sole row.
  const targetResponse =
    partyResponses.find(
      (response) => response.guestId === members[0].guestId,
    ) ??
    partyResponses.find((response) => response.guestId === guestId) ??
    partyResponses[0];

  const write = buildPartyEventRsvpWrite({
    members,
    attendingGuestIds: statuses
      .filter((status) => status.attending)
      .map((status) => status.guestId),
    existingAttendees: partyResponses.flatMap((response) => response.attendees),
  });

  const responseId = targetResponse?.id ?? randomUUID();
  const memberNames = new Set(
    members.map((member) =>
      normalizeName(`${member.firstName} ${member.lastName}`),
    ),
  );

  // Names we are rewriting that also sit under another of the party's
  // responses would otherwise linger and be counted twice.
  const staleAttendeeIds = partyResponses
    .filter((response) => response.id !== responseId)
    .flatMap((response) => response.attendees)
    .filter((attendee) => memberNames.has(normalizeName(attendee.name)))
    .map((attendee) => attendee.id);

  const now = new Date().toISOString();

  try {
    await RsvpRepository.replacePartyEventRsvp({
      response: {
        id: responseId,
        guestId: targetResponse?.guestId ?? members[0].guestId,
        eventId,
        attendanceStatus: write.attendanceStatus,
        numberOfAttending: write.numberOfAttending,
        specialRequests: targetResponse?.specialRequests ?? null,
        submittedAt: targetResponse?.submittedAt ?? now,
        updatedAt: now,
      },
      responseUpdate: {
        attendanceStatus: write.attendanceStatus,
        numberOfAttending: write.numberOfAttending,
        updatedAt: now,
      },
      attendeeRows: write.attendees.map((attendee) => ({
        id: randomUUID(),
        rsvpResponseId: responseId,
        name: attendee.name,
        mealOption: attendee.mealOption,
        dietaryRestrictions: attendee.dietaryRestrictions,
        sortOrder: attendee.sortOrder,
      })),
      staleAttendeeIds,
    });
  } catch (error) {
    logger.error({ err: error, eventId, guestId }, 'Failed to update RSVP');

    return {
      success: false,
      error: 'Failed to update RSVP. Please try again.',
    };
  }

  revalidatePath('/admin/events/[eventId]/rsvps', 'page');
  revalidatePath('/admin/events');
  revalidatePath('/admin/guests');
  revalidatePath('/admin/seating');

  return { success: true };
}
