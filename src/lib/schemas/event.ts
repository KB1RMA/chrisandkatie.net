/**
 * Zod schemas for event form validation.
 *
 * Used for both client-side (react-hook-form) and server-side validation.
 * Includes cross-field time ordering refinement.
 */
import { z } from 'zod';

const YYYY_MM_DD_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM_REGEX = /^\d{2}:\d{2}$/;

/**
 * Validation schema for creating or editing a wedding event.
 *
 * Validates required fields, date/time formats, and ensures endTime
 * comes after startTime.
 */
export const eventFormSchema = z
  .object({
    name: z
      .string({ error: () => ({ message: 'Event name is required' }) })
      .min(1, 'Event name is required'),
    description: z.string().optional(),
    location: z.string().optional(),
    eventDate: z
      .string()
      .regex(YYYY_MM_DD_REGEX, 'Event date must be in YYYY-MM-DD format'),
    startTime: z
      .string()
      .regex(HH_MM_REGEX, 'Start time must be in HH:MM format'),
    endTime: z.string().regex(HH_MM_REGEX, 'End time must be in HH:MM format'),
    type: z.enum(['main', 'rehearsal', 'brunch', 'other']).default('other'),
    dressCode: z.string().optional(),
    parkingInfo: z.string().optional(),
    sortOrder: z.coerce.number().default(0),
    inviteAllGuests: z.boolean().default(false),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  });

export type EventFormData = z.infer<typeof eventFormSchema>;
