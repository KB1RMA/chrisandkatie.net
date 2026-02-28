'use client';

/**
 * LeafletMap — interactive map component powered by react-leaflet + OpenStreetMap tiles.
 *
 * Renders a map at pre-computed coordinates (geocoded at event save time).
 * Accepts lat/lng directly so no client-side geocoding is needed.
 *
 * Must be loaded via next/dynamic with ssr:false — Leaflet requires browser DOM APIs.
 */

import { useEffect } from 'react';
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

export type LeafletMapProps = {
  /** Pre-geocoded latitude coordinate. */
  lat: number;
  /** Pre-geocoded longitude coordinate. */
  lng: number;
  /** Venue name shown in the map popup. */
  label: string;
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
 * Interactive Leaflet map rendered at pre-geocoded coordinates.
 *
 * @param lat - Latitude of the venue.
 * @param lng - Longitude of the venue.
 * @param label - Venue name displayed in the popup.
 * @param height - CSS height string for the map container.
 */
export function LeafletMap({
  lat,
  lng,
  label,
  height = '300px',
}: LeafletMapProps) {
  // SQLite/D1 REAL columns can arrive as strings after RSC serialisation — coerce defensively
  const latNum = Number(lat);
  const lngNum = Number(lng);

  if (!isFinite(latNum) || !isFinite(lngNum)) {
    return null;
  }

  return (
    // Subtle warm filter over the map tiles to harmonise with the site palette
    <div
      style={{ height, filter: 'sepia(8%) brightness(1.02) saturate(0.88)' }}
    >
      <MapContainer
        center={[latNum, lngNum]}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
      >
        <MapCentreUpdater coords={{ lat: latNum, lng: lngNum }} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          maxZoom={20}
        />
        <Marker position={[latNum, lngNum]} icon={brandMarker}>
          <Popup className="venue-popup">{label}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
