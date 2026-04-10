import type { Metadata } from 'next';
import { PhotoBoothClient } from '@/components/photo-booth/PhotoBoothClient';

export const metadata: Metadata = {
  title: 'Photo Booth',
};

/**
 * Photo booth page — server component entry point.
 *
 * Delegates all interactive state to `PhotoBoothClient` (a client component)
 * while keeping data-fetching and metadata concerns server-side.
 *
 * @returns The photo booth page with the client state machine.
 */
export default function PhotoBoothPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#fff7f4] to-[#f3dedb]">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-2 text-center text-3xl font-bold text-[#9e3f3f]">
          Photo Booth
        </h1>
        <p className="mb-8 text-center text-[#6a5555]">
          Capture your favourite moments from our special day!
        </p>
        <PhotoBoothClient />
      </div>
    </main>
  );
}
