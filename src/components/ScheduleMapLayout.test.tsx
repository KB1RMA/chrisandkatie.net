import { expect, test, describe, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ScheduleMapLayout } from '@/components/ScheduleMapLayout';
import type { WeddingEvent } from '@/lib/db/schema';

// Stub next/dynamic so LeafletMap renders synchronously in jsdom
vi.mock('next/dynamic', () => ({
  default: (_importFn: unknown, _opts?: unknown) =>
    function LeafletMapStub({ location }: { location: string }) {
      return <div data-testid="leaflet-map" data-location={location} />;
    },
}));

/**
 * Stubs window.matchMedia to control the useIsDesktop hook in tests.
 *
 * @param matches - Whether the desktop breakpoint should match.
 */
function stubMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

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
    sortOrder: 0,
    rsvpRequired: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('ScheduleMapLayout', () => {
  beforeEach(() => {
    // jsdom does not implement matchMedia — stub it to false (mobile) by default.
    // Individual describe blocks override this for desktop-specific tests.
    stubMatchMedia(false);
  });

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

    test('should not render a pin for events with null location', () => {
      const events = [
        makeEvent({ id: 'event-1', name: 'Ceremony', location: null }),
      ];

      render(<ScheduleMapLayout displayEvents={events} />);

      expect(
        screen.queryByRole('button', { name: 'View location map' }),
      ).not.toBeInTheDocument();
    });

    describe('on desktop (matchMedia matches)', () => {
      beforeEach(() => {
        stubMatchMedia(true);
      });

      test('should render an inline map for each event with a location', () => {
        const events = [
          makeEvent({ id: 'event-1', name: 'Ceremony', location: 'Chapel' }),
          makeEvent({ id: 'event-2', name: 'Reception', location: 'Ballroom' }),
        ];

        render(<ScheduleMapLayout displayEvents={events} />);

        const maps = screen.getAllByTestId('leaflet-map');

        expect(maps).toHaveLength(2);
        expect(maps[0]).toHaveAttribute('data-location', 'Chapel');
        expect(maps[1]).toHaveAttribute('data-location', 'Ballroom');
      });

      test('should not render an inline map for events with null location', () => {
        const events = [
          makeEvent({ id: 'event-1', name: 'Ceremony', location: null }),
        ];

        render(<ScheduleMapLayout displayEvents={events} />);

        expect(screen.queryByTestId('leaflet-map')).not.toBeInTheDocument();
      });
    });

    describe('on mobile (matchMedia does not match)', () => {
      beforeEach(() => {
        stubMatchMedia(false);
      });

      test('should not render inline maps on mobile viewports', () => {
        const events = [
          makeEvent({ id: 'event-1', name: 'Ceremony', location: 'Chapel' }),
        ];

        render(<ScheduleMapLayout displayEvents={events} />);

        expect(screen.queryByTestId('leaflet-map')).not.toBeInTheDocument();
      });
    });
  });

  describe('mobile interactions (window.innerWidth < 1024)', () => {
    beforeEach(() => {
      stubMatchMedia(false);
      // Simulate mobile viewport for handlePinClick branch
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
    });

    test('should open the bottom sheet with the correct event when a pin is clicked on mobile', () => {
      const events = [
        makeEvent({ id: 'event-1', name: 'Ceremony', location: 'The Chapel' }),
      ];

      render(<ScheduleMapLayout displayEvents={events} />);

      fireEvent.click(
        screen.getByRole('button', { name: 'View location map' }),
      );

      const dialog = screen.getByRole('dialog');

      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByText('Ceremony')).toBeInTheDocument();
    });

    test('should show the bottom sheet for the correct event when multiple events exist', () => {
      const events = [
        makeEvent({ id: 'event-1', name: 'Ceremony', location: 'Chapel' }),
        makeEvent({ id: 'event-2', name: 'Reception', location: 'Ballroom' }),
      ];

      render(<ScheduleMapLayout displayEvents={events} />);

      const pinButtons = screen.getAllByRole('button', {
        name: 'View location map',
      });

      // Click the second event's pin
      fireEvent.click(pinButtons[1]);

      const dialog = screen.getByRole('dialog');

      expect(dialog).toBeInTheDocument();
      // The bottom sheet should show the reception event in its header
      expect(within(dialog).getByText('Reception')).toBeInTheDocument();
    });

    test('should close the bottom sheet when onClose is triggered', () => {
      const events = [
        makeEvent({ id: 'event-1', name: 'Ceremony', location: 'Chapel' }),
      ];

      render(<ScheduleMapLayout displayEvents={events} />);

      fireEvent.click(
        screen.getByRole('button', { name: 'View location map' }),
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Close map' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('desktop interactions (window.innerWidth >= 1024)', () => {
    beforeEach(() => {
      stubMatchMedia(true);
      // Simulate desktop viewport for handlePinClick branch
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1280,
      });
    });

    test('should NOT open the bottom sheet when a pin is clicked on desktop', () => {
      const events = [
        makeEvent({ id: 'event-1', name: 'Ceremony', location: 'Chapel' }),
      ];

      render(<ScheduleMapLayout displayEvents={events} />);

      fireEvent.click(
        screen.getByRole('button', { name: 'View location map' }),
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
