import { z } from 'zod';

export const uploadPhotoSchema = z.object({
  guestId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  takenAt: z.string().datetime({ offset: true }).optional(),
  width: z.coerce.number().int().positive().optional(),
  height: z.coerce.number().int().positive().optional(),
});

export const deletePhotoSchema = z.object({
  photoId: z.string().uuid(),
});

export const restorePhotoSchema = z.object({
  photoId: z.string().uuid(),
});
