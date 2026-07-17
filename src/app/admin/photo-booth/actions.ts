'use server';

import { revalidatePath } from 'next/cache';
import { auth, getAuthIdentity } from '@/lib/auth';
import {
  deletePhotoSchema,
  restorePhotoSchema,
} from '@/lib/schemas/photo-booth';
import {
  softDeletePhoto as repoSoftDelete,
  restorePhoto as repoRestore,
} from '@/lib/db/repositories/guestPhotos';
import { broadcastPhotoAlbumMessage } from '@/lib/photo-album-broadcast';
import { WEDDING_ALBUM_ROOM } from '@/lib/schemas/photo-booth';

/**
 * Soft-deletes a guest photo, marking it as removed in the database and
 * broadcasting a removal event to connected photo-album clients.
 *
 * @param input - Object containing the photoId (UUID) to soft-delete.
 * @returns Promise that resolves when the operation is complete.
 * @throws {ZodError} When photoId is not a valid UUID.
 * @throws {Error} 'Unauthorized' when the caller is not an authenticated admin.
 */
export async function softDeletePhoto(input: unknown): Promise<void> {
  const data = deletePhotoSchema.parse(input);

  const identity = getAuthIdentity(await auth());

  if (!identity || identity.type !== 'admin') {
    throw new Error('Unauthorized');
  }

  const photo = await repoSoftDelete(data.photoId, identity.username);
  const room = photo.eventId ?? WEDDING_ALBUM_ROOM;

  broadcastPhotoAlbumMessage(
    { type: 'photo-removed', photoId: data.photoId },
    room,
  );

  revalidatePath('/admin/photo-booth');
}

/**
 * Restores a previously soft-deleted guest photo, setting its status back to
 * visible and broadcasting an addition event to connected photo-album clients.
 *
 * @param input - Object containing the photoId (UUID) to restore.
 * @returns Promise that resolves when the operation is complete.
 * @throws {ZodError} When photoId is not a valid UUID.
 * @throws {Error} 'Unauthorized' when the caller is not an authenticated admin.
 */
export async function restorePhoto(input: unknown): Promise<void> {
  const data = restorePhotoSchema.parse(input);

  const identity = getAuthIdentity(await auth());

  if (!identity || identity.type !== 'admin') {
    throw new Error('Unauthorized');
  }

  const photo = await repoRestore(data.photoId);
  const room = photo.eventId ?? WEDDING_ALBUM_ROOM;

  broadcastPhotoAlbumMessage(
    {
      type: 'photo-added',
      photo: {
        id: photo.id,
        publicUrl: photo.publicUrl,
        width: photo.width,
        height: photo.height,
        uploadedAt: photo.uploadedAt,
      },
    },
    room,
  );

  revalidatePath('/admin/photo-booth');
}
