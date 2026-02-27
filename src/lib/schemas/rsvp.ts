/**
 * Zod schemas for RSVP validation.
 *
 * Used for both client-side (react-hook-form) and server-side validation.
 * Supports both the main wedding RSVP (per-guest) and event-specific RSVPs.
 */
import { z } from 'zod';
import { MEAL_OPTIONS, EVENT_MEAL_OPTIONS } from '@/lib/constants';

/**
 * Schema for updating a single guest RSVP response.
 */
export const guestUpdateSchema = z
  .object({
    id: z.string().min(1, 'Guest ID is required'),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    attending: z.boolean(),
    mealChoice: z
      .enum([
        MEAL_OPTIONS.PRIME_RIB,
        MEAL_OPTIONS.CHICKEN,
        MEAL_OPTIONS.VEGETARIAN,
      ])
      .nullable(),
    dietaryRestrictions: z.string().nullable(),
    notes: z.string().nullable(),
  })
  .refine(
    (data) => {
      // If attending, meal choice is required
      if (data.attending === true && !data.mealChoice) {
        return false;
      }

      return true;
    },
    {
      message: 'Please select a meal choice',
      path: ['mealChoice'],
    },
  );

export type GuestUpdate = z.infer<typeof guestUpdateSchema>;

/**
 * Schema for submitting all RSVP responses for an invitation.
 */
export const submitRsvpSchema = z.object({
  invitationId: z.string().min(1, 'Invitation ID is required'),
  guests: z.array(guestUpdateSchema).min(1, 'At least one guest is required'),
  contactEmail: z
    .string()
    .email('Please enter a valid email address')
    .optional()
    .or(z.literal('')),
});

export type SubmitRsvpInput = z.infer<typeof submitRsvpSchema>;

/**
 * Schema for a single attendee within an event RSVP.
 */
export const eventAttendeeInputSchema = z.object({
  name: z.string().min(1, 'Attendee name is required'),
  mealOption: z.enum([
    EVENT_MEAL_OPTIONS.OPTION_A,
    EVENT_MEAL_OPTIONS.OPTION_B,
  ]),
  dietaryRestrictions: z.string().nullable().optional(),
});

export type EventAttendeeInput = z.infer<typeof eventAttendeeInputSchema>;

/**
 * Schema for submitting or updating an event-specific RSVP.
 * Validates guestId, eventId, attendance, and attendees per the API contract.
 */
export const submitEventRsvpSchema = z
  .object({
    guestId: z.string().min(1, 'Guest ID is required'),
    eventId: z.string().min(1, 'Event ID is required'),
    attendanceStatus: z.enum(['attending', 'not_attending']),
    attendees: z.array(eventAttendeeInputSchema),
    specialRequests: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      // If attending, at least one attendee is required
      if (
        data.attendanceStatus === 'attending' &&
        data.attendees.length === 0
      ) {
        return false;
      }

      return true;
    },
    {
      message: 'At least one attendee is required when attending',
      path: ['attendees'],
    },
  )
  .refine(
    (data) => {
      // If not attending, attendees must be empty
      if (
        data.attendanceStatus === 'not_attending' &&
        data.attendees.length > 0
      ) {
        return false;
      }

      return true;
    },
    {
      message: 'Attendees must be empty when not attending',
      path: ['attendees'],
    },
  );

export type SubmitEventRsvpInput = z.infer<typeof submitEventRsvpSchema>;

/**
 * Output type for an attendee within a retrieved RSVP response.
 */
export type AttendeeOutput = {
  id: string;
  name: string;
  mealOption: 'option_a' | 'option_b';
  dietaryRestrictions: string | null;
  sortOrder: number;
};

/**
 * Output type for an event RSVP response (used across server actions and UI).
 */
export type EventRsvpResponse = {
  id: string;
  guestId: string;
  eventId: string;
  eventName: string;
  eventType: 'main' | 'rehearsal' | 'brunch' | 'other';
  attendanceStatus: 'attending' | 'not_attending';
  numberOfAttending: number;
  specialRequests: string | null;
  attendees: AttendeeOutput[];
  submittedAt: string;
  updatedAt: string;
};
