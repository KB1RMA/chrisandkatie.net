import { expect, test, describe, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScheduleCard } from './ScheduleCard';
import type { WeddingEvent } from '@/lib/db/schema';

/**
 * Creates a minimal WeddingEvent fixture for ScheduleCard tests.
 *
 * @param overrides - Partial fields to override defaults.
 * @returns A WeddingEvent fixture.
 */
function makeEvent(overrides: Partial<WeddingEvent> = {}): WeddingEvent {
  return {
    id: 'event-1',
    name: 'Test Ceremony',
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

describe('ScheduleCard', () => {
  test('should render the event name', () => {
    render(<ScheduleCard item={makeEvent()} />);

    expect(screen.getByText('Test Ceremony')).toBeInTheDocument();
  });

  test('should render the event location', () => {
    render(<ScheduleCard item={makeEvent()} />);

    expect(
      screen.getByText('The Grand Chapel, Boston, MA'),
    ).toBeInTheDocument();
  });

  describe('LocationPin rendering', () => {
    test('should render a LocationPin button when onLocationClick is provided and location is non-null', () => {
      render(
        <ScheduleCard
          item={makeEvent({ location: 'The Grand Chapel, Boston, MA' })}
          onLocationClick={vi.fn()}
        />,
      );

      const pinButton = screen.getByRole('button', {
        name: 'View location map',
      });

      expect(pinButton).toBeInTheDocument();
    });

    test('should not render a LocationPin when location is null', () => {
      render(
        <ScheduleCard
          item={makeEvent({ location: null })}
          onLocationClick={vi.fn()}
        />,
      );

      const pinButton = screen.queryByRole('button', {
        name: 'View location map',
      });

      expect(pinButton).not.toBeInTheDocument();
    });

    test('should not render a LocationPin when onLocationClick is not provided', () => {
      render(<ScheduleCard item={makeEvent({ location: 'Some Place' })} />);

      const pinButton = screen.queryByRole('button', {
        name: 'View location map',
      });

      expect(pinButton).not.toBeInTheDocument();
    });
  });

  describe('mapSlot rendering', () => {
    test('should render mapSlot content when provided', () => {
      render(
        <ScheduleCard
          item={makeEvent()}
          mapSlot={<div data-testid="inline-map">Map goes here</div>}
        />,
      );

      expect(screen.getByTestId('inline-map')).toBeInTheDocument();
    });

    test('should not render a map column when mapSlot is not provided', () => {
      render(<ScheduleCard item={makeEvent()} />);

      expect(screen.queryByTestId('inline-map')).not.toBeInTheDocument();
    });
  });

  describe('parking info rendering', () => {
    test('should render parking info when provided', () => {
      render(
        <ScheduleCard
          item={makeEvent({ parkingInfo: 'Free parking in the adjacent lot' })}
        />,
      );

      expect(
        screen.getByText('Free parking in the adjacent lot'),
      ).toBeInTheDocument();
    });

    test('should not render parking info when null', () => {
      render(<ScheduleCard item={makeEvent({ parkingInfo: null })} />);

      expect(screen.queryByText(/parking/i)).not.toBeInTheDocument();
    });
  });
});
