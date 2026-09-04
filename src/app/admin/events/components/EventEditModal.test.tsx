import { expect, test, describe, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventEditModal from './EventEditModal';
import type { WeddingEvent } from '@/lib/db/schema';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRouterRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
}));

const mockUpdateEvent = vi.fn();

vi.mock('../actions', () => ({
  updateEvent: (...args: unknown[]) => mockUpdateEvent(...args),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const event: WeddingEvent = {
  id: 'event-1',
  name: 'Rehearsal Dinner',
  description: 'Casual dinner the night before',
  location: '123 Main St, Springfield',
  eventDate: '2026-10-09',
  startTime: '18:00',
  endTime: '21:00',
  type: 'rehearsal',
  dressCode: 'Cocktail',
  parkingInfo: 'Valet available',
  locationLat: null,
  locationLng: null,
  sortOrder: 1,
  rsvpRequired: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EventEditModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should pre-populate the form with the event data', () => {
    render(<EventEditModal event={event} onClose={vi.fn()} />);

    expect(screen.getByLabelText(/^name/i)).toHaveValue('Rehearsal Dinner');
    expect(screen.getByLabelText(/event date/i)).toHaveValue('2026-10-09');
    expect(screen.getByLabelText(/start time/i)).toHaveValue('18:00');
    expect(screen.getByLabelText(/end time/i)).toHaveValue('21:00');
    expect(screen.getByLabelText(/dress code/i)).toHaveValue('Cocktail');
    expect(screen.getByLabelText(/rsvp required/i)).toBeChecked();
  });

  test('should show a validation error and not call the server action when name is cleared', async () => {
    const user = userEvent.setup();
    render(<EventEditModal event={event} onClose={vi.fn()} />);

    await user.clear(screen.getByLabelText(/^name/i));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(
      await screen.findByText('Event name is required'),
    ).toBeInTheDocument();
    expect(mockUpdateEvent).not.toHaveBeenCalled();
  });

  test('should submit the edited data with the event id and refresh + close on success', async () => {
    mockUpdateEvent.mockResolvedValue({ success: true });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<EventEditModal event={event} onClose={onClose} />);

    await user.clear(screen.getByLabelText(/^name/i));
    await user.type(screen.getByLabelText(/^name/i), 'Welcome Dinner');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateEvent).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'event-1', name: 'Welcome Dinner' }),
      );
    });
    expect(mockRouterRefresh).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  test('should display the server error and keep the modal open on failure', async () => {
    mockUpdateEvent.mockResolvedValue({
      success: false,
      error: 'Failed to save event',
    });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<EventEditModal event={event} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText('Failed to save event')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  test('should hide the RSVP Required toggle when type is switched to main', async () => {
    const user = userEvent.setup();
    render(<EventEditModal event={event} onClose={vi.fn()} />);

    expect(screen.getByLabelText(/rsvp required/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^type/i), 'main');

    expect(screen.queryByLabelText(/rsvp required/i)).not.toBeInTheDocument();
  });

  test('should call onClose when Cancel is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<EventEditModal event={event} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).toHaveBeenCalled();
  });
});
