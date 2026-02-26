import Link from 'next/link';
import type { Route } from 'next';

export type EventSummaryCardProps = {
  eventId: string;
  eventName: string;
  attending: number;
  notAttending: number;
  noResponse: number;
};

/**
 * Summary card for a single event showing headcounts by RSVP status.
 *
 * @param props - Event name and RSVP status counts.
 * @returns A styled card with attending, not attending, and pending counts.
 * @throws {Error} Does not throw.
 */
export function EventSummaryCard({
  eventId,
  eventName,
  attending,
  notAttending,
  noResponse,
}: EventSummaryCardProps) {
  const total = attending + notAttending + noResponse;

  return (
    <Link href={`/admin/rsvp/${eventId}` as Route}>
      <div className="cursor-pointer rounded-lg bg-[#fffdfb] p-6 shadow transition-shadow hover:shadow-md">
        <h3 className="mb-4 text-lg font-semibold text-[#9e3f3f]">
          {eventName}
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md border-l-4 border-green-500 bg-green-50 p-3">
            <p className="text-xs font-medium text-[#7a6666]">Attending</p>
            <p className="text-2xl font-bold text-green-700">{attending}</p>
          </div>
          <div className="rounded-md border-l-4 border-red-400 bg-red-50 p-3">
            <p className="text-xs font-medium text-[#7a6666]">Declining</p>
            <p className="text-2xl font-bold text-red-700">{notAttending}</p>
          </div>
          <div className="rounded-md border-l-4 border-yellow-400 bg-yellow-50 p-3">
            <p className="text-xs font-medium text-[#7a6666]">Pending</p>
            <p className="text-2xl font-bold text-yellow-700">{noResponse}</p>
          </div>
        </div>
        <p className="mt-3 text-right text-xs text-[#7a6666]">
          {total} invited · click for details
        </p>
      </div>
    </Link>
  );
}
