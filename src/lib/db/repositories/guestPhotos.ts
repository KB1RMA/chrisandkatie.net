/**
 * GuestPhoto repository — all database operations for the GuestPhoto entity.
 *
 * This module owns query logic for guest-uploaded photo booth photos.
 * Server Actions and other callers should use these functions instead of
 * calling the Drizzle client directly.
 */

import { and, desc, eq, getTableColumns, lt } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { guestPhotos, guests } from '@/lib/db/schema';
import type { GuestPhoto } from '@/lib/db/schema';
import { buildPublicUrl } from '@/lib/photo-url';

/**
 * A GuestPhoto row extended with the computed public URL.
 */
export type GuestPhotoWithUrl = GuestPhoto & { publicUrl: string };

/**
 * A GuestPhoto row extended with the computed public URL and uploader's first name.
 */
export type GuestPhotoWithTakenBy = GuestPhotoWithUrl & {
  takenBy: string | null;
};

/**
 * Typed input for inserting a new guest photo row.
 */
export type NewGuestPhotoData = {
  id: string;
  r2Key: string;
  guestId: string;
  eventId: string;
  width?: number;
  height?: number;
  takenAt?: string;
};

/**
 * Insert a new guest photo row and return the inserted record.
 *
 * Sets `uploadedAt` and `updatedAt` to the current ISO timestamp.
 *
 * @param data - The photo fields to insert.
 * @returns The inserted GuestPhoto row.
 */
export async function insertGuestPhoto(
  data: NewGuestPhotoData,
): Promise<GuestPhotoWithUrl> {
  const now = new Date().toISOString();

  const result = await getDb()
    .insert(guestPhotos)
    .values({ ...data, uploadedAt: now, updatedAt: now })
    .returning();

  const inserted = result[0];

  if (!inserted) {
    throw new Error(`Failed to insert guest photo with id ${data.id}`);
  }

  return { ...inserted, publicUrl: buildPublicUrl(inserted.r2Key) };
}

/**
 * Find visible (non-removed) photos, ordered by most recently uploaded.
 *
 * Supports cursor-based pagination using the `uploadedAt` timestamp of the
 * last item on the previous page.
 *
 * @param options - Pagination options.
 * @param options.limit - Maximum number of rows to return.
 * @param options.cursor - ISO timestamp; returns photos uploaded before this value.
 * @returns An array of visible GuestPhoto rows.
 */
export async function findVisiblePhotos({
  limit,
  cursor,
  eventId,
}: {
  limit: number;
  cursor?: string;
  eventId?: string;
}): Promise<GuestPhotoWithTakenBy[]> {
  const conditions = [eq(guestPhotos.status, 'visible')];

  if (cursor) {
    conditions.push(lt(guestPhotos.uploadedAt, cursor));
  }

  if (eventId) {
    conditions.push(eq(guestPhotos.eventId, eventId));
  }

  const rows = await getDb()
    .select({ ...getTableColumns(guestPhotos), takenBy: guests.firstName })
    .from(guestPhotos)
    .leftJoin(guests, eq(guestPhotos.guestId, guests.id))
    .where(and(...conditions))
    .orderBy(desc(guestPhotos.uploadedAt))
    .limit(limit);

  return rows.map((row) => ({ ...row, publicUrl: buildPublicUrl(row.r2Key) }));
}

/**
 * Find all photos regardless of status — for admin use.
 *
 * Supports cursor-based pagination using the `uploadedAt` timestamp of the
 * last item on the previous page.
 *
 * @param options - Pagination options.
 * @param options.limit - Maximum number of rows to return.
 * @param options.cursor - ISO timestamp; returns photos uploaded before this value.
 * @returns An array of GuestPhoto rows.
 */
export async function findAllPhotos({
  limit,
  cursor,
}: {
  limit: number;
  cursor?: string;
}): Promise<GuestPhotoWithUrl[]> {
  const rows = cursor
    ? await getDb()
        .select()
        .from(guestPhotos)
        .where(lt(guestPhotos.uploadedAt, cursor))
        .orderBy(desc(guestPhotos.uploadedAt))
        .limit(limit)
    : await getDb()
        .select()
        .from(guestPhotos)
        .orderBy(desc(guestPhotos.uploadedAt))
        .limit(limit);

  return rows.map((row) => ({ ...row, publicUrl: buildPublicUrl(row.r2Key) }));
}

/**
 * Find a single guest photo by its primary key.
 *
 * @param id - The photo id to look up.
 * @returns The GuestPhoto row, or undefined if not found.
 */
export async function findGuestPhotoById(
  id: string,
): Promise<GuestPhotoWithUrl | undefined> {
  const row = await getDb().query.guestPhotos.findFirst({
    where: eq(guestPhotos.id, id),
  });

  if (!row) {
    return undefined;
  }

  return { ...row, publicUrl: buildPublicUrl(row.r2Key) };
}

/**
 * Soft-delete a photo by setting its status to `removed`.
 *
 * Records who removed the photo and when.
 *
 * @param id - The photo id to soft-delete.
 * @param removedBy - The admin username performing the deletion.
 * @returns The updated GuestPhoto row.
 */
export async function softDeletePhoto(
  id: string,
  removedBy: string,
): Promise<GuestPhotoWithUrl> {
  const now = new Date().toISOString();

  const result = await getDb()
    .update(guestPhotos)
    .set({ status: 'removed', removedAt: now, removedBy, updatedAt: now })
    .where(eq(guestPhotos.id, id))
    .returning();

  const updated = result[0];

  if (!updated) {
    throw new Error(`Guest photo not found: ${id}`);
  }

  return { ...updated, publicUrl: buildPublicUrl(updated.r2Key) };
}

/**
 * Restore a soft-deleted photo by setting its status back to `visible`.
 *
 * Clears the `removedAt` and `removedBy` fields.
 *
 * @param id - The photo id to restore.
 * @returns The updated GuestPhoto row.
 */
export async function restorePhoto(id: string): Promise<GuestPhotoWithUrl> {
  const now = new Date().toISOString();

  const result = await getDb()
    .update(guestPhotos)
    .set({
      status: 'visible',
      removedAt: null,
      removedBy: null,
      updatedAt: now,
    })
    .where(eq(guestPhotos.id, id))
    .returning();

  const updated = result[0];

  if (!updated) {
    throw new Error(`Guest photo not found: ${id}`);
  }

  return { ...updated, publicUrl: buildPublicUrl(updated.r2Key) };
}
