import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

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

import { LeafletMap } from './LeafletMap';

const mockFetch = vi.fn();

describe('LeafletMap', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  test('should show a loading state while geocoding', () => {
    // Never resolves, stays in loading state
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<LeafletMap location="The Grand Chapel, Boston, MA" />);

    expect(screen.getByText('Loading map…')).toBeInTheDocument();
  });

  test('should render the map container when geocoding succeeds', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ lat: '42.3601', lon: '-71.0589' }]),
    });

    render(<LeafletMap location="Boston, MA" />);

    await waitFor(() => {
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });
  });

  test('should render a marker with the location name in a popup', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ lat: '42.3601', lon: '-71.0589' }]),
    });

    render(<LeafletMap location="Boston, MA" />);

    await waitFor(() => {
      expect(screen.getByTestId('map-popup')).toHaveTextContent('Boston, MA');
    });
  });

  test('should show an unavailable state when geocoding returns no results', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(<LeafletMap location="Nonexistent Place XYZ" />);

    await waitFor(() => {
      expect(screen.getByText('Map unavailable')).toBeInTheDocument();
    });
  });

  test('should show an unavailable state when the geocoding fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('network error'));

    render(<LeafletMap location="Some Location" />);

    await waitFor(() => {
      expect(screen.getByText('Map unavailable')).toBeInTheDocument();
    });
  });

  test('should show an unavailable state when the geocoding response is not ok (e.g. 429)', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429 });

    render(<LeafletMap location="Some Location" />);

    await waitFor(() => {
      expect(screen.getByText('Map unavailable')).toBeInTheDocument();
    });
  });

  test('should geocode using the Nominatim API with the encoded location', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ lat: '42.3601', lon: '-71.0589' }]),
    });

    render(<LeafletMap location="The Grand Chapel, Boston, MA" />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          `q=${encodeURIComponent('The Grand Chapel, Boston, MA')}`,
        ),
        expect.objectContaining({ headers: { 'Accept-Language': 'en' } }),
      );
    });
  });
});
