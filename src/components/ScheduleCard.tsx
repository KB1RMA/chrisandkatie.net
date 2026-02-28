'use client';

/**
 * ScheduleCard component for displaying a single schedule event.
 *
 * Shows event timing, location, and details. Highlights the currently
 * happening event with a special "HAPPENING NOW" badge and gold border.
 * On desktop, an optional mapSlot is rendered in a right-hand column
 * alongside the event details.
 */
import type { ReactNode } from 'react';
import type { WeddingEvent } from '@/lib/db/schema';
import { formatEventDate, formatEventTime } from '@/lib/schedule-utils';
import { LocationPin } from './LocationPin';

type ScheduleCardProps = {
  item: WeddingEvent;
  isCurrentEvent?: boolean;
  /** Called when the location pin is clicked. Only rendered when provided and location is non-null. */
  onLocationClick?: () => void;
  /**
   * Optional map content. Stacks below the event details on mobile and
   * renders in a right-hand column on desktop. When provided, the location
   * pin is hidden on lg+ viewports since the map is already visible inline.
   */
  mapSlot?: ReactNode;
};

/**
 * Card displaying a single event in the wedding schedule.
 *
 * @param item - The database event record to display.
 * @param isCurrentEvent - Whether this event is currently happening.
 * @param onLocationClick - Mobile pin handler; omit to hide the pin.
 * @param mapSlot - Optional inline map content shown on desktop.
 */
export function ScheduleCard({
  item,
  isCurrentEvent = false,
  onLocationClick,
  mapSlot,
}: ScheduleCardProps) {
  return (
    <div
      className={`overflow-hidden rounded-lg shadow-lg transition-shadow duration-200 hover:shadow-xl ${
        isCurrentEvent
          ? 'border-2 border-[#c4a44a] bg-[#fdfaf0]'
          : 'bg-[#fffdfb]'
      }`}
    >
      <div className={mapSlot ? 'lg:grid lg:grid-cols-[1fr_380px]' : ''}>
        {/* Event details */}
        <div className="p-8">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold text-[#9e3f3f]">
                  {item.name}
                </h2>

                {onLocationClick && item.location && (
                  // Hide pin on desktop when the map is already visible inline
                  <span className={mapSlot ? 'lg:hidden' : undefined}>
                    <LocationPin onClick={onLocationClick} />
                  </span>
                )}

                {isCurrentEvent && (
                  <span className="rounded-full bg-[#c4a44a] px-3 py-0.5 text-xs font-bold tracking-wide text-white uppercase">
                    Happening Now
                  </span>
                )}
              </div>
              <p className="text-[#7a6666]">
                {formatEventDate(item.eventDate)}
              </p>
            </div>

            <div className="text-right">
              <p className="text-3xl font-bold text-[#9e3f3f]">
                {formatEventTime(item.startTime)}{' '}
                {item.endTime ? `- ${formatEventTime(item.endTime)}` : ''}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-gray-700">{item.location}</p>
            <p className="text-gray-600">{item.description}</p>

            {item.parkingInfo && (
              <p className="flex items-start gap-1.5 text-sm text-[#7a6666]">
                <svg
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  width="16"
                  height="16"
                  className="mt-0.5 shrink-0"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm4 1.5a.75.75 0 01.75-.75h3a3 3 0 010 6H9v2.25a.75.75 0 01-1.5 0V7.5zm1.5.75v3h2.25a1.5 1.5 0 000-3H8.5z"
                    clipRule="evenodd"
                  />
                </svg>
                {item.parkingInfo}
              </p>
            )}
          </div>
        </div>

        {/* Map — stacks below the details on mobile, side column on desktop */}
        {mapSlot && (
          <div className="border-t border-[#f3dedb] lg:flex lg:flex-col lg:border-t-0 lg:border-l">
            {mapSlot}
          </div>
        )}
      </div>
    </div>
  );
}
