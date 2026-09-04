/**
 * Utility functions for building map-related URLs and calculating distances.
 */

/** Tile layer settings passed straight to react-leaflet's `<TileLayer>`. */
export type TileLayerConfig = {
  url: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string;
};

/**
 * Returns the tile layer to render behind the site's Leaflet maps.
 *
 * CARTO's raster basemaps (used for the warm "Voyager" style that matches
 * the site palette) now require a free, domain-restricted API key — without
 * one, CARTO silently serves an "API key required" watermark tile instead of
 * an error. When `NEXT_PUBLIC_CARTO_API_KEY` is configured we use CARTO;
 * otherwise we fall back to plain OpenStreetMap tiles (no key required) so
 * maps still render, just in OSM's default style rather than Voyager's.
 *
 * @returns Tile URL, attribution, and zoom/subdomain settings for `<TileLayer>`.
 */
export function getTileLayerConfig(): TileLayerConfig {
  const cartoApiKey = process.env.NEXT_PUBLIC_CARTO_API_KEY;

  if (cartoApiKey) {
    return {
      url: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${cartoApiKey}`,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    };
  }

  return {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  };
}

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
