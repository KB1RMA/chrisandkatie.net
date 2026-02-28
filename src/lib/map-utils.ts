/**
 * Utility functions for building map-related URLs.
 */

/**
 * Builds a Google Maps directions URL for a given destination string.
 * Uses the directions endpoint so the link opens turn-by-turn navigation
 * rather than a generic search.
 *
 * @param location - The venue or address string to navigate to.
 * @returns A fully encoded Google Maps directions URL.
 */
export function buildGoogleMapsUrl(location: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}`;
}
