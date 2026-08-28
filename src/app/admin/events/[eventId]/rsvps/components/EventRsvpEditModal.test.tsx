import { expect, test, describe, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventRsvpEditModal } from './EventRsvpEditModal';

const mockRouterRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
}));

const mockSetPartyEventRsvp = vi.fn();

vi.mock('../actions', () => ({
  setPartyEventRsvp: (...args: unknown[]) => mockSetPartyEventRsvp(...args),
}));

const members = [
  { id: 'guest-1', guestName: 'Jane Doe', defaultAttending: true },
  { id: 'guest-2', guestName: 'John Doe', defaultAttending: false },
];

/**
 * Renders the modal with sensible defaults.
 *
 * @param overrides - Props to override defaults.
 */
function renderModal(
  overrides: Partial<Parameters<typeof EventRsvpEditModal>[0]> = {},
) {
  const onClose = vi.fn();

  render(
    <EventRsvpEditModal
      eventId="event-1"
      guestId="guest-1"
      partyName="Doe Family"
      members={members}
      hasPartyResponse
      expectedUpdatedAt="2026-07-01T00:00:00.000Z"
      onClose={onClose}
      {...overrides}
    />,
  );

  return { onClose };
}

// jsdom does not implement the native dialog methods the component calls.
beforeEach(() => {
  vi.clearAllMocks();
  mockSetPartyEventRsvp.mockResolvedValue({ success: true });

  HTMLDialogElement.prototype.showModal = vi.fn(function showModal(
    this: HTMLDialogElement,
  ) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function close(
    this: HTMLDialogElement,
  ) {
    this.open = false;
  });
});

describe('EventRsvpEditModal', () => {
  test('should list every party member with their current status preselected', () => {
    renderModal();

    expect(screen.getByText('Doe Family')).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'Jane Doe attending' }),
    ).toBeChecked();
    expect(
      screen.getByRole('radio', { name: 'John Doe not attending' }),
    ).toBeChecked();
  });

  test('should submit a status for the whole party', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole('radio', { name: 'John Doe attending' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockSetPartyEventRsvp).toHaveBeenCalledWith({
        eventId: 'event-1',
        guestId: 'guest-1',
        expectedUpdatedAt: '2026-07-01T00:00:00.000Z',
        statuses: [
          { guestId: 'guest-1', attending: true },
          { guestId: 'guest-2', attending: true },
        ],
      });
    });

    expect(mockRouterRefresh).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  test('should warn when the party has not responded yet', () => {
    renderModal({ hasPartyResponse: false });

    expect(
      screen.getByText(/has not responded through the event RSVP form/i),
    ).toBeInTheDocument();
  });

  test('should not warn when the party has already responded', () => {
    renderModal();

    expect(
      screen.queryByText(/has not responded through the event RSVP form/i),
    ).not.toBeInTheDocument();
  });

  test('should surface an error returned by the action', async () => {
    const user = userEvent.setup();

    mockSetPartyEventRsvp.mockResolvedValue({
      success: false,
      error: 'Guest is not invited to this event.',
    });

    const { onClose } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Guest is not invited to this event.'),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  test('should close without saving on cancel', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockSetPartyEventRsvp).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
