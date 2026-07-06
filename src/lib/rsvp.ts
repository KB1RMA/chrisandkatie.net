/**
 * Pure business logic functions for RSVP validation and computation.
 *
 * All functions are side-effect free and depend only on their inputs.
 * Isolated here so they can be unit tested without database or auth setup.
 */
import { RSVP_DEADLINE } from '@/lib/constants';

/**
 * Check whether the RSVP deadline has passed.
 *
 * @param now - Current date to check against (defaults to current time).
 * @returns True if the RSVP deadline has passed, false otherwise.
 */
export function isDeadlinePassed(now: Date = new Date()): boolean {
  return now > RSVP_DEADLINE;
}

/**
 * Check whether a guest can still modify their RSVP.
 *
 * @param now - Current date to check against (defaults to current time).
 * @returns True if RSVP modifications are allowed, false if locked.
 */
export function canModifyRsvp(now: Date = new Date()): boolean {
  return !isDeadlinePassed(now);
}

/**
 * Validate attendee names against the pre-registered guest list on the invitation.
 *
 * Each attendee must match a pre-registered guest name (case-insensitive).
 * Returns an array of validation errors (empty array = valid).
 *
 * @param attendeeNames - Names submitted as attending.
 * @param registeredNames - Pre-registered guest names from the invitation.
 * @returns Array of error messages for unrecognized names.
 */
export function validateAttendeeNames(
  attendeeNames: string[],
  registeredNames: string[],
): string[] {
  const normalizedRegistered = registeredNames.map((name) =>
    name.toLowerCase().trim(),
  );

  return attendeeNames
    .filter((name) => !normalizedRegistered.includes(name.toLowerCase().trim()))
    .map((name) => `"${name}" is not on the guest list for this invitation.`);
}

/**
 * Validate that attendee list does not exceed the invitation's max guests.
 *
 * @param attendeeCount - Number of attendees being submitted.
 * @param maxGuests - Maximum guests allowed on the invitation.
 * @returns Error message if exceeded, null if valid.
 */
export function validateAttendeeCount(
  attendeeCount: number,
  maxGuests: number,
): string | null {
  if (attendeeCount > maxGuests) {
    return `Too many attendees. This invitation allows a maximum of ${maxGuests} guest(s).`;
  }

  return null;
}

/**
 * Calculate total number of attendees in an RSVP response list.
 *
 * Only counts responses where attendanceStatus is "attending".
 *
 * @param responses - Array of RSVP responses with attendance status and count.
 * @returns Total number of attending guests.
 */
export function calculateTotalAttending(
  responses: Array<{ attendanceStatus: string; numberOfAttending: number }>,
): number {
  return responses
    .filter((response) => response.attendanceStatus === 'attending')
    .reduce((total, response) => total + response.numberOfAttending, 0);
}

/**
 * Validate attendees against the guest list and invitation limits.
 *
 * @param attendeeNames - Names submitted as attending.
 * @param registeredNames - Pre-registered guest names on the invitation.
 * @param maxGuests - Maximum guests allowed on the invitation.
 * @returns Array of validation error messages (empty = valid).
 */
export function validateAttendeeAgainstInvitation(
  attendeeNames: string[],
  registeredNames: string[],
  maxGuests: number,
): string[] {
  const nameErrors = validateAttendeeNames(attendeeNames, registeredNames);
  const countError = validateAttendeeCount(attendeeNames.length, maxGuests);

  return countError ? [...nameErrors, countError] : nameErrors;
}

/** Per-guest attendance status derived from stored RSVP data. */
export type EventReconstructionStatus =
  'attending' | 'not_attending' | 'no_response';

/** A guest invited to an event, tagged with their party (invitation). */
export type InvitedGuestInput = {
  guestId: string;
  firstName: string;
  lastName: string;
  invitationId: string;
};

/** A stored RSVP response for an event, tagged with the responder's party. */
export type EventResponseInput = {
  invitationId: string;
  attendanceStatus: 'attending' | 'not_attending';
  attendeeNames: string[];
};

/** Resolved status for a single invited guest. */
export type ReconstructedGuestStatus = {
  guestId: string;
  status: EventReconstructionStatus;
};

/** Aggregated per-person attendance counts for an event. */
export type EventRsvpSummary = {
  attending: number;
  notAttending: number;
  noResponse: number;
  total: number;
};

/** Per-guest statuses plus the aggregated summary for an event. */
export type EventRsvpReconstruction = {
  statuses: ReconstructedGuestStatus[];
  summary: EventRsvpSummary;
};

/**
 * Normalize a name for case-insensitive, whitespace-insensitive matching.
 *
 * Lowercases, trims leading/trailing whitespace, and collapses internal
 * whitespace runs so that `"John  Smith"` matches `"John Smith"`.
 *
 * @param name - Raw name value.
 * @returns Lowercased name with normalized whitespace.
 */
export function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Reconstruct per-person RSVP status for an event from data as it is stored.
 *
 * RSVPs are stored as one response per party (invitation), with the attending
 * people recorded as attendee name rows. Non-submitting party members have no
 * response row of their own, so their status is derived by matching their name
 * against the party's attending attendees.
 *
 * Status rule, per invited guest:
 * - No response exists for the guest's party -> `no_response`.
 * - The guest's name matches an attending attendee in their party -> `attending`.
 * - Otherwise (party responded but the guest is not attending) -> `not_attending`.
 *   This covers both members omitted from an attending response and party-level
 *   declines (which store zero attendee names).
 *
 * @param invitedGuests - Guests invited to the event, each tagged with their invitationId.
 * @param responses - RSVP responses for the event, each tagged with the responder's invitationId and attendee names.
 * @returns Per-guest statuses and the aggregated attendance summary.
 */
export function reconstructEventRsvpStatuses(
  invitedGuests: InvitedGuestInput[],
  responses: EventResponseInput[],
): EventRsvpReconstruction {
  const respondedInvitations = new Set(responses.map((r) => r.invitationId));

  const attendingNamesByInvitation = responses
    .filter((response) => response.attendanceStatus === 'attending')
    .reduce((acc, response) => {
      const existing = acc.get(response.invitationId) ?? new Set<string>();

      response.attendeeNames.forEach((name) =>
        existing.add(normalizeName(name)),
      );
      acc.set(response.invitationId, existing);

      return acc;
    }, new Map<string, Set<string>>());

  const statuses: ReconstructedGuestStatus[] = invitedGuests.map((guest) => {
    if (!respondedInvitations.has(guest.invitationId)) {
      return { guestId: guest.guestId, status: 'no_response' };
    }

    const attendingNames = attendingNamesByInvitation.get(guest.invitationId);
    const fullName = normalizeName(`${guest.firstName} ${guest.lastName}`);

    if (attendingNames?.has(fullName)) {
      return { guestId: guest.guestId, status: 'attending' };
    }

    return { guestId: guest.guestId, status: 'not_attending' };
  });

  const summary = statuses.reduce<EventRsvpSummary>(
    (acc, { status }) => {
      if (status === 'attending') {
        return { ...acc, attending: acc.attending + 1, total: acc.total + 1 };
      }

      if (status === 'not_attending') {
        return {
          ...acc,
          notAttending: acc.notAttending + 1,
          total: acc.total + 1,
        };
      }

      return { ...acc, noResponse: acc.noResponse + 1, total: acc.total + 1 };
    },
    { attending: 0, notAttending: 0, noResponse: 0, total: 0 },
  );

  return { statuses, summary };
}
