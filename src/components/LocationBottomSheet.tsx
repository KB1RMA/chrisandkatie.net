'use client';

/**
 * LocationBottomSheet — slide-up overlay for mobile map display.
 *
 * Shows event name, an interactive Leaflet map, and a Google Maps directions link.
 * Dismissed via close button, backdrop click, or swipe-down gesture.
 */

import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';
import { buildGoogleMapsUrl } from '@/lib/map-utils';
import type { WeddingEvent } from '@/lib/db/schema';

// Load LeafletMap client-only — Leaflet requires browser DOM APIs
const LeafletMap = dynamic(
  () =>
    import('@/components/LeafletMap').then((mod) => ({
      default: mod.LeafletMap,
    })),
  { ssr: false },
);

type LocationBottomSheetProps = {
  /** Controls visibility and slide-up state. */
  open: boolean;
  /** Event to display. Null is allowed for the unmounted/closed state. */
  event: WeddingEvent | null;
  /** Fired when the user dismisses the sheet. */
  onClose: () => void;
};

/**
 * Slide-up bottom sheet overlay for displaying event location maps on mobile.
 *
 * @param open - Whether the sheet is currently visible.
 * @param event - The event whose location is displayed.
 * @param onClose - Called when the user dismisses the sheet.
 */
export function LocationBottomSheet({
  open,
  event,
  onClose,
}: LocationBottomSheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const touchStartY = useRef<number>(0);
  const touchCurrentY = useRef<number>(0);

  // Auto-focus close button when sheet opens for accessibility
  useEffect(() => {
    if (open && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [open]);

  if (!open || !event) {
    return null;
  }

  const directionsSrc = event.location
    ? buildGoogleMapsUrl(event.location)
    : null;

  /**
   * Handle swipe-down gesture to dismiss the sheet.
   */
  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
    touchCurrentY.current = e.touches[0].clientY;
  }

  function handleTouchMove(e: React.TouchEvent) {
    touchCurrentY.current = e.touches[0].clientY;
  }

  function handleTouchEnd() {
    const swipeDistance = touchCurrentY.current - touchStartY.current;

    if (swipeDistance >= 80) {
      onClose();
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Event location">
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet panel */}
      <div
        className="fixed right-0 bottom-0 left-0 z-50 flex max-h-[80vh] translate-y-0 flex-col rounded-t-2xl bg-[#fffdfb] shadow-xl transition-transform duration-300 ease-in-out"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#f3dedb] p-4">
          <h2 className="text-lg font-bold text-[#9e3f3f]">{event.name}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close map"
            onClick={onClose}
            className="p-1 text-[#9e3f3f] transition-colors duration-150 hover:text-[#7a2f2f]"
          >
            ✕
          </button>
        </div>

        {/* Map */}
        {event.location && (
          <LeafletMap location={event.location} height="260px" />
        )}

        {/* Directions link */}
        {directionsSrc && (
          <div className="p-4">
            <a
              href={directionsSrc}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#9e3f3f] hover:underline"
            >
              Get Directions ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
