'use client';

/**
 * HotelRouteMap — dual-pin Leaflet map showing the walking route from a hotel to the venue.
 *
 * Renders a hotel marker and a venue marker connected by a dashed Polyline to indicate
 * the approximate walking path. Map bounds are auto-fitted to show both pins.
 *
 * Must be loaded via next/dynamic with ssr:false — Leaflet requires browser DOM APIs.
 */

import { useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import { getTileLayerConfig } from '@/lib/map-utils';

const tileLayer = getTileLayerConfig();

// Brand-red pin for the venue, matching the site palette
const venueMarker = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z" fill="#9e3f3f"/>
    <circle cx="12" cy="12" r="4.5" fill="#fff" fill-opacity="0.9"/>
  </svg>`,
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -36],
});

// Muted pin for the hotel
const hotelMarker = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z" fill="#6a5555"/>
    <circle cx="12" cy="12" r="4.5" fill="#fff" fill-opacity="0.9"/>
  </svg>`,
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -36],
});

type MapBoundsUpdaterProps = {
  lat1: number;
  lng1: number;
  lat2: number;
  lng2: number;
};

/**
 * Imperatively fits the map bounds to show both markers on mount.
 *
 * @param lat1 - Hotel latitude.
 * @param lng1 - Hotel longitude.
 * @param lat2 - Venue latitude.
 * @param lng2 - Venue longitude.
 */
function MapBoundsUpdater({ lat1, lng1, lat2, lng2 }: MapBoundsUpdaterProps) {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(
      [
        [lat1, lng1],
        [lat2, lng2],
      ],
      { padding: [40, 40] },
    );
  }, [map, lat1, lng1, lat2, lng2]);

  return null;
}

export type HotelRouteMapProps = {
  /** Latitude of the hotel. */
  hotelLat: number | string;
  /** Longitude of the hotel. */
  hotelLng: number | string;
  /** Hotel name displayed in the pin popup. */
  hotelName: string;
  /** Latitude of the venue. */
  venueLat: number | string;
  /** Longitude of the venue. */
  venueLng: number | string;
  /** Venue name displayed in the pin popup. */
  venueName: string;
  /** CSS height for the map container. Defaults to 280px. */
  height?: string;
};

/**
 * Dual-pin Leaflet map with a dashed route line from hotel to venue.
 *
 * @param hotelLat - Latitude of the hotel.
 * @param hotelLng - Longitude of the hotel.
 * @param hotelName - Hotel display name for the popup.
 * @param venueLat - Latitude of the venue.
 * @param venueLng - Longitude of the venue.
 * @param venueName - Venue display name for the popup.
 * @param height - CSS height string for the map container.
 */
export function HotelRouteMap({
  hotelLat,
  hotelLng,
  hotelName,
  venueLat,
  venueLng,
  venueName,
  height = '280px',
}: HotelRouteMapProps) {
  const lat1 = Number(hotelLat);
  const lng1 = Number(hotelLng);
  const lat2 = Number(venueLat);
  const lng2 = Number(venueLng);

  if (
    !isFinite(lat1) ||
    !isFinite(lng1) ||
    !isFinite(lat2) ||
    !isFinite(lng2)
  ) {
    return null;
  }

  const hotelPos = useMemo<[number, number]>(() => [lat1, lng1], [lat1, lng1]);
  const venuePos = useMemo<[number, number]>(() => [lat2, lng2], [lat2, lng2]);
  const routePositions = useMemo<[[number, number], [number, number]]>(
    () => [hotelPos, venuePos],
    [hotelPos, venuePos],
  );

  return (
    <div
      style={{ height, filter: 'sepia(8%) brightness(1.02) saturate(0.88)' }}
    >
      <MapContainer
        center={[(lat1 + lat2) / 2, (lng1 + lng2) / 2]}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
      >
        <MapBoundsUpdater lat1={lat1} lng1={lng1} lat2={lat2} lng2={lng2} />
        <TileLayer
          attribution={tileLayer.attribution}
          url={tileLayer.url}
          subdomains={tileLayer.subdomains}
          maxZoom={tileLayer.maxZoom}
        />
        <Marker position={hotelPos} icon={hotelMarker}>
          <Popup>{hotelName}</Popup>
        </Marker>
        <Marker position={venuePos} icon={venueMarker}>
          <Popup>{venueName}</Popup>
        </Marker>
        <Polyline
          positions={routePositions}
          pathOptions={{
            color: '#9e3f3f',
            dashArray: '8, 8',
            weight: 2,
            opacity: 0.7,
          }}
        />
      </MapContainer>
    </div>
  );
}
