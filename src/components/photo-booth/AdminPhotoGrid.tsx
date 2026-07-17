'use client';

import { useOptimistic, useState, useTransition } from 'react';
import type { GuestPhoto } from '@/lib/db/schema';
import type { GuestPhotoAdminRow } from '@/lib/db/repositories/guestPhotos';
import { softDeletePhoto, restorePhoto } from '@/app/admin/photo-booth/actions';

type AdminPhotoGridProps = {
  photos: GuestPhotoAdminRow[];
};

/**
 * Admin photo grid component for moderating guest photo booth uploads.
 *
 * Displays all photos (visible and removed) with controls to soft-delete or
 * restore each photo. The server-provided `photos` prop is the source of
 * truth; status changes are applied optimistically via useOptimistic and
 * settle into the revalidated server data (or revert to it on error).
 *
 * @param photos - All guest photos to display, regardless of status.
 * @returns A responsive grid of photo cards with moderation controls.
 */
export function AdminPhotoGrid({ photos: serverPhotos }: AdminPhotoGridProps) {
  const [photos, applyOptimisticStatus] = useOptimistic(
    serverPhotos,
    (current, update: { photoId: string; status: GuestPhoto['status'] }) =>
      current.map((photo) =>
        photo.id === update.photoId
          ? { ...photo, status: update.status }
          : photo,
      ),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  /**
   * Optimistically updates a photo's status and calls the server action; the
   * optimistic state reverts to the server data automatically on failure.
   */
  function handleAction(
    photoId: string,
    optimisticStatus: GuestPhoto['status'],
    action: (input: unknown) => Promise<void>,
  ) {
    setErrorMessage(null);

    startTransition(async () => {
      applyOptimisticStatus({ photoId, status: optimisticStatus });

      try {
        await action({ photoId });
      } catch {
        setErrorMessage('Action failed. Please try again.');
      }
    });
  }

  return (
    <div>
      {errorMessage && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {photos.length === 0 && (
        <p className="py-12 text-center text-sm text-gray-500">
          No photos yet.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="group relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
          >
            {/* Photo image */}
            <div className="relative aspect-square w-full overflow-hidden bg-gray-100">
              <img
                src={photo.publicUrl}
                alt="Guest photo"
                className="h-full w-full object-cover"
              />

              {/* Dimmed overlay for removed photos */}
              {photo.status === 'removed' && (
                <div className="absolute inset-0 bg-black/50" />
              )}
            </div>

            {/* Uploader and event context */}
            <div className="px-3 pt-2 text-xs text-gray-600">
              <p className="truncate font-medium">
                {photo.takenBy ?? 'Unknown guest'}
              </p>
              <p className="truncate text-gray-400">
                {photo.eventName ?? 'No event'}
              </p>
            </div>

            {/* Card footer with status badge and action button */}
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              {photo.status === 'visible' ? (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  Visible
                </span>
              ) : (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  Removed
                </span>
              )}

              {photo.status === 'visible' ? (
                <button
                  disabled={isPending}
                  onClick={() =>
                    handleAction(photo.id, 'removed', softDeletePhoto)
                  }
                  className="rounded px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  Remove
                </button>
              ) : (
                <button
                  disabled={isPending}
                  onClick={() =>
                    handleAction(photo.id, 'visible', restorePhoto)
                  }
                  className="rounded px-2 py-1 text-xs font-medium text-green-600 transition-colors hover:bg-green-50 disabled:opacity-50"
                >
                  Restore
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
