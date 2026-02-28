'use client';

/**
 * ScheduleMapLayout — client wrapper component for the schedule page map experience.
 *
 * On desktop each event card renders its own inline Leaflet map in a right-hand
 * column. On mobile a bottom sheet overlay is used when a location pin is tapped.
 * Maps are only mounted on desktop to avoid unnecessary geocoding on mobile.
 */

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { WeddingEvent } from '@/lib/db/schema';
import { isCurrentEvent } from '@/lib/schedule-utils';
import { buildGoogleMapsUrl } from '@/lib/map-utils';
import { ScheduleCard } from './ScheduleCard';
import { LocationBottomSheet } from './LocationBottomSheet';

// Load LeafletMap client-only — Leaflet requires browser DOM APIs
const LeafletMap = dynamic(
  () =>
    import('@/components/LeafletMap').then((mod) => ({
      default: mod.LeafletMap,
    })),
  { ssr: false },
);

const DESKTOP_BREAKPOINT = '(min-width: 1024px)';

/**
 * Returns true only when the viewport matches the desktop breakpoint.
 * Defaults to false on the server and on first render to prevent hydration
 * mismatches and avoid mounting maps on mobile.
 */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_BREAKPOINT);

    setIsDesktop(mediaQuery.matches);

    function handleChange(e: MediaQueryListEvent) {
      setIsDesktop(e.matches);
    }

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return isDesktop;
}

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
  const isDesktop = useIsDesktop();
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [bottomSheetEvent, setBottomSheetEvent] = useState<WeddingEvent | null>(
    null,
  );

  /**
   * Handle a pin click — opens the bottom sheet on mobile.
   * On desktop the map is already visible inline in the card.
   *
   * @param event - The event whose pin was clicked.
   */
  function handlePinClick(event: WeddingEvent) {
    if (window.innerWidth < 1024) {
      setBottomSheetEvent(event);
      setIsBottomSheetOpen(true);
    }
  }

  /**
   * Dismiss the mobile bottom sheet.
   */
  function handleSheetClose() {
    setIsBottomSheetOpen(false);
  }

  return (
    <>
      <div className="space-y-6">
        {displayEvents.map((item) => (
          <ScheduleCard
            key={item.id}
            item={item}
            isCurrentEvent={isCurrentEvent(item)}
            onLocationClick={
              item.location ? () => handlePinClick(item) : undefined
            }
            mapSlot={
              isDesktop && item.location ? (
                <>
                  <LeafletMap location={item.location} height="100%" />
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
              ) : undefined
            }
          />
        ))}
      </div>

      <LocationBottomSheet
        open={isBottomSheetOpen}
        event={bottomSheetEvent}
        onClose={handleSheetClose}
      />
    </>
  );
}
