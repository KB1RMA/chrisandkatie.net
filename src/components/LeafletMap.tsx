'use client';

/**
 * LeafletMap — interactive map component powered by react-leaflet + OpenStreetMap tiles.
 *
 * Geocodes a location string via Nominatim on mount, then renders a MapContainer
 * with a tile layer and a marker at the resolved coordinates.
 *
 * Must be loaded via next/dynamic with ssr:false — Leaflet requires browser DOM APIs.
 */

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Brand-red pin to match site palette — rendered as an inline SVG DivIcon
const brandMarker = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z" fill="#9e3f3f"/>
    <circle cx="12" cy="12" r="4.5" fill="#fff" fill-opacity="0.9"/>
  </svg>`,
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -36],
});

type Coordinates = {
  lat: number;
  lng: number;
};

type NominatimResult = {
  lat: string;
  lon: string;
};

export type LeafletMapProps = {
  /** Venue or address string to geocode and display. */
  location: string;
  /** CSS height for the map container. Defaults to 300px. */
  height?: string;
};

/**
 * Imperatively re-centres the map when coordinates change.
 *
 * @param coords - The new centre coordinates.
 */
function MapCentreUpdater({ coords }: { coords: Coordinates }) {
  const map = useMap();

  useEffect(() => {
    map.setView([coords.lat, coords.lng], 15);
  }, [map, coords]);

  return null;
}

/**
 * Interactive Leaflet map that geocodes a location string and shows a marker.
 *
 * @param location - Address or venue name to display on the map.
 * @param height - CSS height string for the map container.
 */
export function LeafletMap({ location, height = '300px' }: LeafletMapProps) {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancel any in-flight request when location changes
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setHasError(false);

    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`,
      {
        signal: controller.signal,
        headers: { 'Accept-Language': 'en' },
      },
    )
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Geocoding request failed: ${res.status}`);
        }

        return res.json() as Promise<NominatimResult[]>;
      })
      .then((data) => {
        if (data.length > 0) {
          setCoords({
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
          });
        } else {
          setHasError(true);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name !== 'AbortError') {
          setHasError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [location]);

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center bg-[#f8f4f4]"
        style={{ height }}
      >
        <p className="text-sm text-[#7a6666]">Loading map…</p>
      </div>
    );
  }

  if (hasError || !coords) {
    return (
      <div
        className="flex items-center justify-center bg-[#f8f4f4]"
        style={{ height }}
      >
        <p className="text-sm text-[#7a6666]">Map unavailable</p>
      </div>
    );
  }

  return (
    // Subtle warm filter over the map tiles to harmonise with the site palette
    <div
      style={{ height, filter: 'sepia(8%) brightness(1.02) saturate(0.88)' }}
    >
      <MapContainer
        center={[coords.lat, coords.lng]}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
      >
        <MapCentreUpdater coords={coords} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          maxZoom={20}
        />
        <Marker position={[coords.lat, coords.lng]} icon={brandMarker}>
          <Popup className="venue-popup">{location}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
