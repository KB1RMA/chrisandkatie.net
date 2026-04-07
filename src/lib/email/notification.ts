/**
 * Email notification utilities for RSVP submissions.
 *
 * Provides shared types, payload builder, and Resend dispatch helper
 * for the RSVP notification pipeline.
 */
import { Resend } from 'resend';
import type { EventRsvpResponse } from '@/lib/schemas/rsvp';
import { RsvpNotificationEmail } from './RsvpNotificationEmail';

/**
 * Thrown when an email failure is permanent and should NOT be retried.
 * Examples: 4xx Resend errors, missing API key or recipient configuration.
 */
export class PermanentEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentEmailError';
  }
}

export type RsvpNotificationAttendee = {
  name: string;
  mealOption: string | null;
  dietaryRestrictions: string | null;
};

export type RsvpNotificationPayload = {
  isUpdate: boolean;
  guestName: string;
  eventName: string;
  attendanceStatus: 'attending' | 'not_attending';
  numberOfAttending: number;
  specialRequests: string | null;
  attendees: RsvpNotificationAttendee[];
};

/**
 * Build a notification payload from a saved RSVP response.
 *
 * @param rsvp - The full EventRsvpResponse returned after save.
 * @param guestName - The display name of the submitting guest.
 * @param isUpdate - Whether this RSVP is an update to an existing response.
 * @returns A serialisable RsvpNotificationPayload ready for queue dispatch.
 */
export function buildNotificationPayload(
  rsvp: EventRsvpResponse,
  guestName: string,
  isUpdate: boolean,
): RsvpNotificationPayload {
  return {
    isUpdate,
    guestName,
    eventName: rsvp.eventName,
    attendanceStatus: rsvp.attendanceStatus,
    numberOfAttending: rsvp.numberOfAttending,
    specialRequests: rsvp.specialRequests,
    attendees: rsvp.attendees.map((a) => ({
      name: a.name,
      mealOption: a.mealOption,
      dietaryRestrictions: a.dietaryRestrictions,
    })),
  };
}

/**
 * Send an RSVP notification email via Resend.
 *
 * Throws on transient failures (5xx, network errors) so the queue consumer
 * can retry. Swallows and logs permanent failures (4xx) since retrying will
 * not fix them.
 *
 * @param payload - The notification payload to render and send.
 * @param env - Cloudflare environment bindings (RESEND_API_KEY, OWNER_EMAIL).
 * @throws Error on transient failures that should trigger a queue retry.
 */
export async function sendRsvpNotificationEmail(
  payload: RsvpNotificationPayload,
  env: { RESEND_API_KEY?: string; OWNER_EMAIL?: string },
): Promise<void> {
  if (!env.RESEND_API_KEY) {
    throw new PermanentEmailError('RESEND_API_KEY is not set');
  }

  if (!env.OWNER_EMAIL) {
    throw new PermanentEmailError('OWNER_EMAIL is not set');
  }

  const resend = new Resend(env.RESEND_API_KEY);

  const subject = payload.isUpdate
    ? `[Updated RSVP] ${payload.guestName} — ${payload.eventName}`
    : `[New RSVP] ${payload.guestName} — ${payload.eventName}`;

  const { data, error } = await resend.emails.send({
    from: 'noreply@chrisandkatie.net',
    to: env.OWNER_EMAIL,
    subject,
    react: RsvpNotificationEmail(payload),
  });

  if (error) {
    // Permanent failures (4xx) — retrying will not help
    const status = (error as { statusCode?: number }).statusCode ?? 0;

    if (status >= 400 && status < 500) {
      throw new PermanentEmailError(
        `Resend permanent error (${status}): ${error.message}`,
      );
    }

    // Transient failure — throw so the queue consumer can call message.retry()
    throw new Error(
      `[rsvp-notification] Resend transient error: ${error.message}`,
    );
  }

  console.log('[rsvp-notification] Email sent, id:', data?.id);
}
