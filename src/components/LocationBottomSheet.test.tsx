import { expect, test, describe, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocationBottomSheet } from '@/components/LocationBottomSheet';
import type { WeddingEvent } from '@/lib/db/schema';

// Stub next/dynamic so LeafletMap renders synchronously in jsdom
vi.mock('next/dynamic', () => ({
  default: (_importFn: unknown, _opts?: unknown) =>
    function LeafletMapStub({ location }: { location: string }) {
      return <div data-testid="leaflet-map" data-location={location} />;
    },
}));

/**
 * Creates a WeddingEvent fixture for LocationBottomSheet tests.
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

describe('LocationBottomSheet', () => {
  test('should not show dialog content when closed (open=false)', () => {
    render(
      <LocationBottomSheet
        open={false}
        event={makeEvent()}
        onClose={vi.fn()}
      />,
    );

    // Close button should not be visible/interactive when sheet is closed
    expect(
      screen.queryByRole('button', { name: 'Close map' }),
    ).not.toBeInTheDocument();
  });

  test('should render the event name in the header when open', () => {
    render(
      <LocationBottomSheet open={true} event={makeEvent()} onClose={vi.fn()} />,
    );

    expect(screen.getByText('Wedding Ceremony')).toBeInTheDocument();
  });

  test('should render a LeafletMap with the correct location attribute when open', () => {
    const event = makeEvent({ location: 'The Grand Chapel, Boston, MA' });

    render(<LocationBottomSheet open={true} event={event} onClose={vi.fn()} />);

    const mapStub = screen.getByTestId('leaflet-map');

    expect(mapStub).toBeInTheDocument();
    expect(mapStub).toHaveAttribute(
      'data-location',
      'The Grand Chapel, Boston, MA',
    );
  });

  test('should render a Get Directions link with the correct href when open', () => {
    const event = makeEvent({ location: 'The Grand Chapel, Boston, MA' });

    render(<LocationBottomSheet open={true} event={event} onClose={vi.fn()} />);

    const link = screen.getByRole('link', { name: /Get Directions/i });

    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'href',
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent('The Grand Chapel, Boston, MA')}`,
    );
    expect(link).toHaveAttribute('target', '_blank');
  });

  test('should call onClose when the close button is clicked', () => {
    const handleClose = vi.fn();

    render(
      <LocationBottomSheet
        open={true}
        event={makeEvent()}
        onClose={handleClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close map' }));

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  test('should have role="dialog" with aria-modal="true" when open', () => {
    render(
      <LocationBottomSheet open={true} event={makeEvent()} onClose={vi.fn()} />,
    );

    const dialog = screen.getByRole('dialog');

    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
