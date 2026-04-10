import { findVisiblePhotos } from '@/lib/db/repositories/guestPhotos';
import { AlbumGrid } from '@/components/photo-booth/AlbumGrid';

const INITIAL_PAGE_SIZE = 24;

/**
 * Album page for the photo booth feature.
 *
 * Fetches the first page of visible photos server-side and passes them to the
 * real-time `AlbumGrid` client component to avoid layout shift on initial render.
 *
 * @returns The photo booth album page.
 */
export default async function PhotoBoothAlbumPage() {
  const photos = await findVisiblePhotos({ limit: INITIAL_PAGE_SIZE });

  const initialPhotos = photos.map((p) => ({
    id: p.id,
    publicUrl: p.publicUrl,
    width: p.width,
    height: p.height,
    uploadedAt: p.uploadedAt,
  }));

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-center text-3xl font-bold tracking-tight text-stone-800">
        Photo Booth Album
      </h1>
      <AlbumGrid initialPhotos={initialPhotos} />
    </main>
  );
}
