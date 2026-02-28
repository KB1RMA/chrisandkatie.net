/**
 * Server-side geocoding utilities using the Nominatim OpenStreetMap API.
 *
 * These functions are safe to call from Server Actions but must NOT be
 * imported into client components (`'use client'` files).
 */

type Coordinates = {
  lat: number;
  lng: number;
};

type NominatimResult = {
  lat: string;
  lon: string;
};

/**
 * Geocodes a location string via Nominatim, returning lat/lng coordinates.
 *
 * Returns null when geocoding fails, the service is unreachable, or no
 * results are found — callers should handle a null result gracefully (e.g.
 * save the event without coordinates).
 *
 * @param location - Venue name or address string to geocode.
 * @returns Coordinates or null on failure.
 */
export async function geocodeLocation(
  location: string,
): Promise<Coordinates | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`;

  try {
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'chrisandkatie.net/1.0 (wedding website)',
      },
    });

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as NominatimResult[];

    if (data.length === 0) {
      return null;
    }

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
  } catch {
    return null;
  }
}
