'use client';

/**
 * ScheduleMapLayout — client wrapper component for the schedule page map experience.
 *
 * Each event card with a location renders an interactive Leaflet map inline.
 * On mobile the map stacks below the event details; on desktop it appears in
 * a right-hand column alongside the card content.
 */

import dynamic from 'next/dynamic';
import type { WeddingEvent } from '@/lib/db/schema';
import { isCurrentEvent } from '@/lib/schedule-utils';
import { buildGoogleMapsUrl } from '@/lib/map-utils';
import { ScheduleCard } from './ScheduleCard';

// Load LeafletMap client-only — Leaflet requires browser DOM APIs
const LeafletMap = dynamic(
  () =>
    import('@/components/LeafletMap').then((mod) => ({
      default: mod.LeafletMap,
    })),
  { ssr: false },
);

type ScheduleMapLayoutProps = {
  /** Pre-filtered, sorted events for the current viewer. */
  displayEvents: WeddingEvent[];
};

/**
 * Layout component managing schedule event cards with interactive per-card maps.
 *
 * @param displayEvents - Sorted event list from the server component.
 */
export function ScheduleMapLayout({ displayEvents }: ScheduleMapLayoutProps) {
  return (
    <div className="space-y-6">
      {displayEvents.map((item) => (
        <ScheduleCard
          key={item.id}
          item={item}
          isCurrentEvent={isCurrentEvent(item)}
          mapSlot={
            item.location &&
            item.locationLat != null &&
            item.locationLng != null ? (
              <>
                <LeafletMap
                  lat={item.locationLat}
                  lng={item.locationLng}
                  label={item.location}
                  height="300px"
                />
                <div className="border-t border-[#f3dedb] p-3">
                  <a
                    href={buildGoogleMapsUrl(item.location)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#9e3f3f] hover:underline"
                  >
                    Get Directions ↗
                  </a>
                </div>
              </>
            ) : item.location ? (
              // Fallback for events that haven't been geocoded yet — plain directions link
              <div className="flex items-center border-t border-[#f3dedb] p-3 lg:border-t-0 lg:border-l">
                <a
                  href={buildGoogleMapsUrl(item.location)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#9e3f3f] hover:underline"
                >
                  Get Directions ↗
                </a>
              </div>
            ) : undefined
          }
        />
      ))}
    </div>
  );
}
