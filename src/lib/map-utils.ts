/**
 * Utility functions for building map-related URLs and calculating distances.
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

/**
 * Builds a Google Maps walking directions URL from an origin to a destination.
 *
 * @param origin - Starting address or place name.
 * @param destination - Destination address or place name.
 * @returns A fully encoded Google Maps walking directions URL.
 */
export function buildWalkingDirectionsUrl(
  origin: string,
  destination: string,
): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=walking`;
}

/**
 * Calculates the straight-line (haversine) distance between two coordinates.
 *
 * @param lat1 - Latitude of point A.
 * @param lng1 - Longitude of point A.
 * @param lat2 - Latitude of point B.
 * @param lng2 - Longitude of point B.
 * @returns Distance in kilometres.
 */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Estimates walking time in minutes from a distance in kilometres.
 * Assumes an average walking speed of 4.8 km/h.
 *
 * @param distanceKm - Distance in kilometres.
 * @returns Rounded walking time in minutes.
 */
export function estimatedWalkingMinutes(distanceKm: number): number {
  const WALKING_SPEED_KMH = 4.8;

  return Math.round((distanceKm / WALKING_SPEED_KMH) * 60);
}
