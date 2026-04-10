import { notFound } from 'next/navigation';
import { PhotoBoothClient } from '@/components/photo-booth/PhotoBoothClient';
import { AlbumGrid } from '@/components/photo-booth/AlbumGrid';
import { findVisiblePhotos } from '@/lib/db/repositories/guestPhotos';
import {
  findEventById,
  findEventsByInvitationId,
} from '@/lib/db/repositories/events';
import { auth, getAuthIdentity } from '@/lib/auth';

const INITIAL_PAGE_SIZE = 24;

type Props = {
  params: Promise<{ eventId: string }>;
};

/**
 * Per-event photo booth page.
 *
 * Validates the event exists and that the authenticated guest is invited to
 * it, then renders the camera and live album scoped to that event.
 * Photos taken here are tagged with the event ID.
 *
 * @param params - Dynamic route params containing `eventId`.
 * @returns The event-scoped camera and album page, or 404 if the event is not found or the guest is not invited.
 */
export default async function EventPhotoBoothPage({ params }: Props) {
  const { eventId } = await params;

  const session = await auth();
  const identity = getAuthIdentity(session);

  if (!identity || identity.type !== 'guest') {
    notFound();
  }

  const [event, visibleEvents] = await Promise.all([
    findEventById(eventId),
    findEventsByInvitationId(identity.invitationId),
  ]);

  if (!event) {
    notFound();
  }

  const isAllowed = visibleEvents.some((e) => e.id === eventId);

  if (!isAllowed) {
    notFound();
  }

  const photos = await findVisiblePhotos({
    limit: INITIAL_PAGE_SIZE + 1,
    eventId,
  });

  const hasMore = photos.length > INITIAL_PAGE_SIZE;
  const trimmed = hasMore ? photos.slice(0, INITIAL_PAGE_SIZE) : photos;
  const initialNextCursor = hasMore
    ? trimmed[trimmed.length - 1].uploadedAt
    : null;

  const initialPhotos = trimmed.map((p) => ({
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
        <AlbumGrid
          initialPhotos={initialPhotos}
          initialNextCursor={initialNextCursor}
          initialHasMore={hasMore}
          eventId={eventId}
        />
      </div>
    </main>
  );
}
