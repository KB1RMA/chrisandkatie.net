import type { Metadata } from 'next';
import { findAllPhotos } from '@/lib/db/repositories/guestPhotos';
import { AdminPhotoGrid } from '@/components/photo-booth/AdminPhotoGrid';

export const metadata: Metadata = { title: 'Admin — Photo Booth' };

/**
 * Admin photo booth management page.
 *
 * Fetches all guest photos (visible and removed) and renders the moderation
 * grid. Auth is enforced by the parent admin layout.
 *
 * @returns Server-rendered page with the AdminPhotoGrid component.
 */
export default async function AdminPhotoBoothPage() {
  const photos = await findAllPhotos({ limit: 100 });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Photo Booth</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review and moderate guest photo booth submissions.
        </p>
      </div>

      <AdminPhotoGrid photos={photos} />
    </div>
  );
}
