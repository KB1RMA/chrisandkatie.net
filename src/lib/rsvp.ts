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
