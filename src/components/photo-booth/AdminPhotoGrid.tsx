'use client';

import { useState, useTransition } from 'react';
import type { GuestPhoto } from '@/lib/db/schema';
import { softDeletePhoto, restorePhoto } from '@/app/admin/photo-booth/actions';

type AdminPhotoGridProps = {
  photos: GuestPhoto[];
};

/**
 * Admin photo grid component for moderating guest photo booth uploads.
 *
 * Displays all photos (visible and removed) with controls to soft-delete or
 * restore each photo. Updates local state optimistically on action, reverting
 * on error.
 *
 * @param photos - All guest photos to display, regardless of status.
 * @returns A responsive grid of photo cards with moderation controls.
 */
export function AdminPhotoGrid({ photos: initialPhotos }: AdminPhotoGridProps) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  /**
   * Optimistically updates a photo's status, calls the server action, and
   * reverts on failure.
   */
  function handleAction(
    photoId: string,
    optimisticStatus: GuestPhoto['status'],
    action: (input: unknown) => Promise<void>,
  ) {
    const previous = photos;

    setPhotos((current) =>
      current.map((photo) =>
        photo.id === photoId ? { ...photo, status: optimisticStatus } : photo,
      ),
    );
    setErrorMessage(null);

    startTransition(async () => {
      try {
        await action({ photoId });
      } catch {
        setPhotos(previous);
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
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
