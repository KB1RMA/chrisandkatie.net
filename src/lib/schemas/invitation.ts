/**
 * Zod schemas for invitation form validation.
 *
 * Used for both client-side (react-hook-form) and server-side validation.
 */
import { z } from 'zod';

/**
 * Transforms a string field: trims whitespace and converts blank strings to
 * `undefined` so they are not persisted as empty strings. Safe for fields with
 * UNIQUE constraints (e.g. `invitationCode`) where multiple empty strings would
 * collide while multiple NULLs would not.
 */
const optionalString = z
  .string()
  .transform((value) => value.trim() || undefined)
  .optional();

/**
 * Validation schema for editing an invitation's details.
 */
export const invitationEditSchema = z.object({
  mailingAddress: z.string().min(1, 'Mailing address is required'),
  relationshipToCouple: optionalString,
  totalInvited: z.coerce
    .number()
    .int('Must be a whole number')
    .min(1, 'Must invite at least 1 guest'),
  invitationCode: optionalString,
  address: optionalString,
  addressLine2: optionalString,
  city: optionalString,
  state: optionalString,
  zipCode: optionalString,
  country: optionalString,
});

export type InvitationEditFormData = z.infer<typeof invitationEditSchema>;
