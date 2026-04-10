import { notFound } from 'next/navigation';
import { PhotoBoothClient } from '@/components/photo-booth/PhotoBoothClient';
import { AlbumGrid } from '@/components/photo-booth/AlbumGrid';
import { findVisiblePhotos } from '@/lib/db/repositories/guestPhotos';
import { findEventById } from '@/lib/db/repositories/events';

const INITIAL_PAGE_SIZE = 24;

type Props = {
  params: Promise<{ eventId: string }>;
};

/**
 * Per-event photo booth page.
 *
 * Validates the event exists, then renders the camera and live album scoped
 * to that event. Photos taken here are tagged with the event ID.
 *
 * @param params - Dynamic route params containing `eventId`.
 * @returns The event-scoped camera and album page, or 404 if the event is not found.
 */
export default async function EventPhotoBoothPage({ params }: Props) {
  const { eventId } = await params;

  const event = await findEventById(eventId);

  if (!event) {
    notFound();
  }

  const photos = await findVisiblePhotos({ limit: INITIAL_PAGE_SIZE, eventId });

  const initialPhotos = photos.map((p) => ({
    id: p.id,
    publicUrl: p.publicUrl,
    width: p.width,
    height: p.height,
    uploadedAt: p.uploadedAt,
    takenBy: p.takenBy,
  }));

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#fff7f4] to-[#f3dedb]">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-2 text-center text-3xl font-bold text-[#9e3f3f]">
          {event.name}
        </h1>
        <p className="mb-8 text-center text-[#6a5555]">
          Capture your favorite moments!
        </p>
        <PhotoBoothClient eventId={eventId} />
      </div>
      <div id="album" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-center text-2xl font-bold tracking-tight text-stone-800">
          Album
        </h2>
        <AlbumGrid initialPhotos={initialPhotos} eventId={eventId} />
      </div>
    </main>
  );
}
