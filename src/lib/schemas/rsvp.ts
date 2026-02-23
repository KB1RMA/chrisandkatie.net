/**
 * Zod schemas for RSVP validation.
 *
 * Used for both client-side (react-hook-form) and server-side validation.
 */
import { z } from 'zod';
import { MEAL_OPTIONS } from '@/lib/constants';

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
});

export type SubmitRsvpInput = z.infer<typeof submitRsvpSchema>;
