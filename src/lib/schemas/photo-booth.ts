import { z } from 'zod';

export const uploadPhotoSchema = z.object({
  guestId: z.string().uuid().optional(),
  eventId: z.string().min(1),
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

/**
 * Room name for the main wedding album. Event-scoped albums use the event id
 * as their room name.
 */
export const WEDDING_ALBUM_ROOM = 'wedding-album';

/**
 * Realtime messages broadcast to photo-album rooms. Shared by the server-side
 * producers (`broadcastPhotoAlbumMessage` callers) and the browser consumer
 * (`AlbumGrid`) so both ends agree on the wire format.
 */
export const photoAlbumMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('photo-added'),
    photo: z.object({
      id: z.string().min(1),
      publicUrl: z.string().min(1),
      width: z.number().int().positive().nullish(),
      height: z.number().int().positive().nullish(),
      uploadedAt: z.string().min(1),
    }),
  }),
  z.object({
    type: z.literal('photo-removed'),
    photoId: z.string().min(1),
  }),
]);

export type PhotoAlbumMessage = z.infer<typeof photoAlbumMessageSchema>;
