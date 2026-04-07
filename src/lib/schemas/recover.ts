import { z } from 'zod';

/**
 * Validation schema for the invitation code recovery form.
 * All fields are trimmed and must be non-empty strings.
 */
export const recoverSchema = z.object({
  lastName: z.string().trim().min(1, 'Last name is required'),
  streetAddress: z.string().trim().min(1, 'Street address is required'),
  zipCode: z.string().trim().min(1, 'ZIP code is required'),
});

export type RecoverInput = z.infer<typeof recoverSchema>;
