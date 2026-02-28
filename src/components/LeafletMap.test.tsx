import { expect, test, describe } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock react-leaflet to avoid DOM/canvas errors in jsdom
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
  useMap: () => ({ setView: vi.fn() }),
}));

// Mock Leaflet to prevent icon URL errors
vi.mock('leaflet', () => ({
  default: {
    Icon: {
      Default: {
        prototype: {},
        mergeOptions: vi.fn(),
      },
    },
    divIcon: vi.fn(() => ({})),
  },
}));

import { vi } from 'vitest';
import { LeafletMap } from './LeafletMap';

describe('LeafletMap', () => {
  test('should render the map container with the provided coordinates', () => {
    render(<LeafletMap lat={42.3601} lng={-71.0589} label="Boston, MA" />);

    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  test('should render a marker for the location', () => {
    render(<LeafletMap lat={42.3601} lng={-71.0589} label="Boston, MA" />);

    expect(screen.getByTestId('map-marker')).toBeInTheDocument();
  });

  test('should display the venue label in the popup', () => {
    render(
      <LeafletMap lat={42.3601} lng={-71.0589} label="The Grand Chapel" />,
    );

    expect(screen.getByTestId('map-popup')).toHaveTextContent(
      'The Grand Chapel',
    );
  });

  test('should apply the given height to the map wrapper', () => {
    const { container } = render(
      <LeafletMap lat={42.3601} lng={-71.0589} label="Test" height="400px" />,
    );

    // eslint-disable-next-line testing-library/no-node-access
    expect(container.firstChild).toHaveStyle({ height: '400px' });
  });

  test('should default to 300px height when none is provided', () => {
    const { container } = render(
      <LeafletMap lat={42.3601} lng={-71.0589} label="Test" />,
    );

    // eslint-disable-next-line testing-library/no-node-access
    expect(container.firstChild).toHaveStyle({ height: '300px' });
  });
});
