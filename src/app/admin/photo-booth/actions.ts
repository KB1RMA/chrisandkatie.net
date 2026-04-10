'use server';

import { auth, getAuthIdentity } from '@/lib/auth';
import {
  deletePhotoSchema,
  restorePhotoSchema,
} from '@/lib/schemas/photo-booth';
import {
  softDeletePhoto as repoSoftDelete,
  restorePhoto as repoRestore,
  findGuestPhotoById,
} from '@/lib/db/repositories/guestPhotos';
import { notifyPartyKit } from '@/lib/partykit';

/**
 * Soft-deletes a guest photo, marking it as removed in the database and
 * broadcasting a removal event to connected PartyKit clients.
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

  await repoSoftDelete(data.photoId, identity.username);

  void notifyPartyKit({ type: 'photo-removed', photoId: data.photoId });
}

/**
 * Restores a previously soft-deleted guest photo, setting its status back to
 * visible and broadcasting an addition event to connected PartyKit clients.
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

  await repoRestore(data.photoId);

  const photo = await findGuestPhotoById(data.photoId);

  void notifyPartyKit({
    type: 'photo-added',
    photo: {
      id: data.photoId,
      publicUrl: photo?.publicUrl ?? '',
      uploadedAt: photo?.uploadedAt ?? '',
    },
  });
}
