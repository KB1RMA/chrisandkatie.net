import { Marcellus } from 'next/font/google';
import type { Metadata } from 'next';
import Link from 'next/link';
import { findAllPhotos } from '@/lib/db/repositories/guestPhotos';
import { findAllEvents } from '@/lib/db/repositories/events';
import { AdminTabs } from '@/components/admin/AdminTabs';
import { AdminPhotoGrid } from '@/components/photo-booth/AdminPhotoGrid';
import { cn } from '@/lib/cn';

export const dynamic = 'force-dynamic';

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
});

export const metadata: Metadata = {
  title: 'Admin — Photo Booth',
  description: 'Admin moderation view of guest photo booth uploads by event.',
};

const PAGE_SIZE = 100;

type Props = {
  searchParams: Promise<{ eventId?: string }>;
};

/**
 * Admin photo booth management page.
 *
 * Fetches guest photos (visible and removed), optionally filtered to a single
 * event via the `eventId` search param, and renders the moderation grid with
 * per-event filter links. Auth is enforced by the parent admin layout.
 *
 * @param searchParams - Optional `eventId` to scope the grid to one event.
 * @returns Server-rendered page with event filters and the AdminPhotoGrid.
 */
export default async function AdminPhotoBoothPage({ searchParams }: Props) {
  const { eventId } = await searchParams;

  const allEvents = await findAllEvents();
  const activeEvent = allEvents.find((event) => event.id === eventId);

  const photos = await findAllPhotos({
    limit: PAGE_SIZE,
    eventId: activeEvent?.id,
  });

  const filterPillClassName =
    'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium transition-colors';

  return (
    <div className="font-roboto min-h-screen bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-4 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <h1
          className={`${marcellus.className} mb-8 text-center text-5xl font-bold text-[#9e3f3f]`}
        >
          Photo Booth
        </h1>

        <AdminTabs />

        <div className="mt-8">
          <p className="mb-4 text-sm text-[#6a5555]">
            Review and moderate guest photo booth submissions.
          </p>

          <div className="mb-6 flex flex-wrap gap-2">
            <Link
              href="/admin/photo-booth"
              className={cn(
                filterPillClassName,
                activeEvent
                  ? 'bg-white text-[#6a5555] hover:bg-[#f3dedb] hover:text-[#9e3f3f]'
                  : 'bg-[#9e3f3f] text-white',
              )}
            >
              All Events
            </Link>

            {allEvents.map((event) => (
              <Link
                key={event.id}
                href={`/admin/photo-booth?eventId=${event.id}`}
                className={cn(
                  filterPillClassName,
                  event.id === activeEvent?.id
                    ? 'bg-[#9e3f3f] text-white'
                    : 'bg-white text-[#6a5555] hover:bg-[#f3dedb] hover:text-[#9e3f3f]',
                )}
              >
                {event.name}
              </Link>
            ))}
          </div>

          <AdminPhotoGrid photos={photos} />
        </div>
      </div>
    </div>
  );
}
