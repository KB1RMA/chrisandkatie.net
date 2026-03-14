import { expect, test, describe } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-leaflet', () => ({
  MapContainer: ({
    children,
  }: {
    children: React.ReactNode;
    center: [number, number];
    zoom: number;
    style: React.CSSProperties;
  }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-marker">{children}</div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-popup">{children}</div>
  ),
  Polyline: () => <div data-testid="map-polyline" />,
  useMap: () => ({ fitBounds: vi.fn() }),
}));

vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn(() => ({})),
  },
}));

import { vi } from 'vitest';
import { HotelRouteMap } from './HotelRouteMap';

const DEFAULT_PROPS = {
  hotelLat: 42.8133,
  hotelLng: -70.879,
  hotelName: 'Hygge House Suites',
  venueLat: 42.81075658532706,
  venueLng: -70.87293203187453,
  venueName: 'Test Venue',
};

describe('HotelRouteMap', () => {
  test('should render the map container', () => {
    render(<HotelRouteMap {...DEFAULT_PROPS} />);

    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  test('should render the hotel name in a popup', () => {
    render(<HotelRouteMap {...DEFAULT_PROPS} />);

    expect(screen.getByText('Hygge House Suites')).toBeInTheDocument();
  });

  test('should render the venue name in a popup', () => {
    render(<HotelRouteMap {...DEFAULT_PROPS} />);

    expect(screen.getByText('Test Venue')).toBeInTheDocument();
  });

  test('should render two markers', () => {
    render(<HotelRouteMap {...DEFAULT_PROPS} />);

    expect(screen.getAllByTestId('map-marker')).toHaveLength(2);
  });

  test('should render the route polyline', () => {
    render(<HotelRouteMap {...DEFAULT_PROPS} />);

    expect(screen.getByTestId('map-polyline')).toBeInTheDocument();
  });
});
