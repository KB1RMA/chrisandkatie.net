import { expect, test, describe, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventCreateModal from './EventCreateModal';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRouterRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
}));

const mockCreateEvent = vi.fn();

vi.mock('../actions', () => ({
  createEvent: (...args: unknown[]) => mockCreateEvent(...args),
}));

// LocationAutocomplete calls the Nominatim geocoding API on every keystroke;
// none of these tests touch the location field, so it is left unmocked.

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^name/i), 'Welcome Party');
  await user.type(screen.getByLabelText(/event date/i), '2026-10-10');
  await user.type(screen.getByLabelText(/start time/i), '18:00');
  await user.type(screen.getByLabelText(/end time/i), '21:00');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EventCreateModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should render the create event form', () => {
    render(<EventCreateModal onClose={vi.fn()} />);

    expect(
      screen.getByRole('heading', { name: 'Create Event' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /create event/i }),
    ).toBeInTheDocument();
  });

  test('should show validation errors and not call the server action when required fields are blank', async () => {
    const user = userEvent.setup();
    render(<EventCreateModal onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /create event/i }));

    expect(
      await screen.findByText('Event name is required'),
    ).toBeInTheDocument();
    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  test('should show a validation error when end time is not after start time', async () => {
    const user = userEvent.setup();
    render(<EventCreateModal onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/^name/i), 'Welcome Party');
    await user.type(screen.getByLabelText(/event date/i), '2026-10-10');
    await user.type(screen.getByLabelText(/start time/i), '21:00');
    await user.type(screen.getByLabelText(/end time/i), '18:00');
    await user.click(screen.getByRole('button', { name: /create event/i }));

    expect(
      await screen.findByText('End time must be after start time'),
    ).toBeInTheDocument();
    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  test('should submit valid data to the server action and refresh + close on success', async () => {
    mockCreateEvent.mockResolvedValue({ success: true, data: { id: 'e1' } });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<EventCreateModal onClose={onClose} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /create event/i }));

    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Welcome Party',
          eventDate: '2026-10-10',
          startTime: '18:00',
          endTime: '21:00',
        }),
      );
    });
    expect(mockRouterRefresh).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  test('should display the server error and keep the modal open on failure', async () => {
    mockCreateEvent.mockResolvedValue({
      success: false,
      error: 'An event already exists on that date',
    });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<EventCreateModal onClose={onClose} />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /create event/i }));

    expect(
      await screen.findByText('An event already exists on that date'),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  test('should hide the RSVP Required toggle for main-type events', async () => {
    const user = userEvent.setup();
    render(<EventCreateModal onClose={vi.fn()} />);

    expect(screen.getByLabelText(/rsvp required/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^type/i), 'main');

    expect(screen.queryByLabelText(/rsvp required/i)).not.toBeInTheDocument();
  });

  test('should call onClose when Cancel is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<EventCreateModal onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).toHaveBeenCalled();
  });
});
