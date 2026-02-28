import { expect, test, describe, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScheduleMapLayout } from '@/components/ScheduleMapLayout';
import type { WeddingEvent } from '@/lib/db/schema';

// Stub next/dynamic so LeafletMap renders synchronously in jsdom
vi.mock('next/dynamic', () => ({
  default: (_importFn: unknown, _opts?: unknown) =>
    function LeafletMapStub({
      label,
    }: {
      lat: number;
      lng: number;
      label: string;
    }) {
      return <div data-testid="leaflet-map" data-location={label} />;
    },
}));

/**
 * Creates a WeddingEvent fixture for ScheduleMapLayout tests.
 *
 * @param overrides - Partial fields to override defaults.
 * @returns A WeddingEvent fixture.
 */
function makeEvent(overrides: Partial<WeddingEvent> = {}): WeddingEvent {
  return {
    id: 'event-1',
    name: 'Wedding Ceremony',
    description: 'A beautiful ceremony',
    location: 'The Grand Chapel, Boston, MA',
    eventDate: '2025-09-13',
    startTime: '16:00',
    endTime: '18:00',
    type: 'main',
    dressCode: null,
    parkingInfo: null,
    locationLat: null,
    locationLng: null,
    sortOrder: 0,
    rsvpRequired: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('ScheduleMapLayout', () => {
  describe('event card rendering', () => {
    test('should render all event cards', () => {
      const events = [
        makeEvent({ id: 'event-1', name: 'Ceremony' }),
        makeEvent({ id: 'event-2', name: 'Reception' }),
        makeEvent({ id: 'event-3', name: 'Rehearsal Dinner' }),
      ];

      render(<ScheduleMapLayout displayEvents={events} />);

      expect(screen.getByText('Ceremony')).toBeInTheDocument();
      expect(screen.getByText('Reception')).toBeInTheDocument();
      expect(screen.getByText('Rehearsal Dinner')).toBeInTheDocument();
    });

    test('should not render a location pin button for events', () => {
      const events = [makeEvent({ id: 'event-1', name: 'Ceremony' })];

      render(<ScheduleMapLayout displayEvents={events} />);

      // ScheduleMapLayout does not pass onLocationClick — maps are always visible inline
      expect(
        screen.queryByRole('button', { name: 'View location map' }),
      ).not.toBeInTheDocument();
    });

    test('should render a map for each event with geocoded coordinates', () => {
      const events = [
        makeEvent({
          id: 'event-1',
          name: 'Ceremony',
          location: 'Chapel',
          locationLat: 42.36,
          locationLng: -71.06,
        }),
        makeEvent({
          id: 'event-2',
          name: 'Reception',
          location: 'Ballroom',
          locationLat: 40.71,
          locationLng: -74.01,
        }),
      ];

      render(<ScheduleMapLayout displayEvents={events} />);

      const maps = screen.getAllByTestId('leaflet-map');

      expect(maps).toHaveLength(2);
      expect(maps[0]).toHaveAttribute('data-location', 'Chapel');
      expect(maps[1]).toHaveAttribute('data-location', 'Ballroom');
    });

    test('should not render a map for events with null location', () => {
      const events = [
        makeEvent({ id: 'event-1', name: 'Ceremony', location: null }),
      ];

      render(<ScheduleMapLayout displayEvents={events} />);

      expect(screen.queryByTestId('leaflet-map')).not.toBeInTheDocument();
    });

    test('should not render a map when location has no geocoded coordinates', () => {
      const events = [
        makeEvent({
          id: 'event-1',
          name: 'Ceremony',
          location: 'Chapel',
          locationLat: null,
          locationLng: null,
        }),
      ];

      render(<ScheduleMapLayout displayEvents={events} />);

      expect(screen.queryByTestId('leaflet-map')).not.toBeInTheDocument();
    });
  });

  describe('Get Directions link', () => {
    test('should render a Get Directions link for events with a location', () => {
      const events = [
        makeEvent({
          id: 'event-1',
          location: 'The Grand Chapel, Boston, MA',
          locationLat: 42.36,
          locationLng: -71.06,
        }),
      ];

      render(<ScheduleMapLayout displayEvents={events} />);

      const link = screen.getByRole('link', { name: /Get Directions/i });

      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('target', '_blank');
    });

    test('should render a Get Directions link for events with a location but no geocoded coordinates', () => {
      const events = [
        makeEvent({
          id: 'event-1',
          location: 'The Grand Chapel, Boston, MA',
          locationLat: null,
          locationLng: null,
        }),
      ];

      render(<ScheduleMapLayout displayEvents={events} />);

      const link = screen.getByRole('link', { name: /Get Directions/i });

      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('target', '_blank');
    });

    test('should not render a Get Directions link for events without a location', () => {
      const events = [makeEvent({ id: 'event-1', location: null })];

      render(<ScheduleMapLayout displayEvents={events} />);

      expect(
        screen.queryByRole('link', { name: /Get Directions/i }),
      ).not.toBeInTheDocument();
    });
  });
});
