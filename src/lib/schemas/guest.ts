/**
 * Zod schemas for guest form validation.
 *
 * Used for both client-side (react-hook-form) and server-side validation.
 */
import { z } from 'zod';

/**
 * Validation schema for adding a new guest to an existing invitation.
 */
export const addGuestSchema = z.object({
  invitationId: z.string().min(1),
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  type: z.enum(['adult', 'child']),
});

export type AddGuestInput = z.infer<typeof addGuestSchema>;

/**
 * Validation schema for removing a guest from an invitation.
 */
export const removeGuestSchema = z.object({
  guestId: z.string().min(1),
  invitationId: z.string().min(1),
});

export type RemoveGuestInput = z.infer<typeof removeGuestSchema>;
