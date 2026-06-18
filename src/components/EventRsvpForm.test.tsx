import { expect, test, describe, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventRsvpForm } from './EventRsvpForm';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRouterPush = vi.fn();
const mockRouterRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, refresh: mockRouterRefresh }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockSubmitEventRsvp = vi.fn();

vi.mock('@/app/rsvp/(portal)/[eventId]/actions', () => ({
  submitEventRsvp: (...args: unknown[]) => mockSubmitEventRsvp(...args),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const invitationGuests = [
  { id: 'guest-1', firstName: 'Alice', lastName: 'E2E' },
];

/**
 * Renders the EventRsvpForm with sensible defaults.
 *
 * @param overrides - Props to override defaults.
 */
function renderForm(
  overrides: Partial<Parameters<typeof EventRsvpForm>[0]> = {},
) {
  render(
    <EventRsvpForm
      eventId="event-rehearsal"
      guestId="guest-1"
      invitationGuests={invitationGuests}
      existingRsvp={null}
      deadlinePassed={false}
      eventName="Rehearsal Dinner"
      eventType="rehearsal"
      {...overrides}
    />,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EventRsvpForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('conditional rendering by eventType', () => {
    test('should NOT show Meal Choice section when eventType is rehearsal', async () => {
      const user = userEvent.setup();

      renderForm({ eventType: 'rehearsal' });

      // Select attending and open the attendee checklist
      await user.click(screen.getByText('Yes, I will attend'));
      await user.click(screen.getByText('Alice E2E'));

      expect(screen.queryByText('Meal Choice *')).not.toBeInTheDocument();
    });

    test('should NOT show Dietary Restrictions field when eventType is rehearsal', async () => {
      const user = userEvent.setup();

      renderForm({ eventType: 'rehearsal' });

      // Select attending and open the attendee checklist
      await user.click(screen.getByText('Yes, I will attend'));
      await user.click(screen.getByText('Alice E2E'));

      expect(
        screen.queryByLabelText(/Dietary Restrictions/i),
      ).not.toBeInTheDocument();
    });

    test('should NOT show Special Requests section when eventType is rehearsal', () => {
      renderForm({ eventType: 'rehearsal' });

      expect(
        screen.queryByLabelText(/Special Requests/i),
      ).not.toBeInTheDocument();
    });

    test('should show Meal Choice section when eventType is main', async () => {
      const user = userEvent.setup();

      renderForm({ eventType: 'main', eventName: 'Wedding Reception' });

      // Select attending first to reveal the attendee checklist
      await user.click(screen.getByText('Yes, I will attend'));

      // Check the guest checkbox to reveal meal choice
      await user.click(screen.getByText('Alice E2E'));

      expect(screen.getByText('Meal Choice *')).toBeInTheDocument();
    });

    test('should show Special Requests section when eventType is main', () => {
      renderForm({ eventType: 'main', eventName: 'Wedding Reception' });

      expect(screen.getByLabelText(/Special Requests/i)).toBeInTheDocument();
    });
  });

  describe('form submission behaviour', () => {
    test('should call router.push("/rsvp") on successful submission', async () => {
      const user = userEvent.setup();

      mockSubmitEventRsvp.mockResolvedValue({
        attendanceStatus: 'not_attending',
      });

      renderForm({ eventType: 'rehearsal' });

      // Select "not attending" so no attendee details are required
      await user.click(screen.getByText('No, I cannot make it'));

      await user.click(screen.getByRole('button', { name: /Submit RSVP/i }));

      await waitFor(() => {
        expect(mockRouterPush).toHaveBeenCalledWith('/rsvp?step=3');
      });
    });

    test('should NOT call router.refresh() on successful submission', async () => {
      const user = userEvent.setup();

      mockSubmitEventRsvp.mockResolvedValue({
        attendanceStatus: 'not_attending',
      });

      renderForm({ eventType: 'rehearsal' });

      await user.click(screen.getByText('No, I cannot make it'));

      await user.click(screen.getByRole('button', { name: /Submit RSVP/i }));

      await waitFor(() => {
        expect(mockRouterPush).toHaveBeenCalledWith('/rsvp?step=3');
      });

      expect(mockRouterRefresh).not.toHaveBeenCalled();
    });
  });

  describe('past-deadline behaviour', () => {
    test('should show an advisory notice but still allow submission when deadlinePassed', async () => {
      const user = userEvent.setup();

      mockSubmitEventRsvp.mockResolvedValue({
        attendanceStatus: 'not_attending',
      });

      renderForm({ eventType: 'rehearsal', deadlinePassed: true });

      expect(screen.getByText('RSVP Deadline Has Passed')).toBeInTheDocument();

      await user.click(screen.getByText('No, I cannot make it'));

      await user.click(screen.getByRole('button', { name: /Submit RSVP/i }));

      await waitFor(() => {
        expect(mockSubmitEventRsvp).toHaveBeenCalledOnce();
        expect(mockRouterPush).toHaveBeenCalledWith('/rsvp?step=3');
      });
    });

    test('should allow selecting attendees when deadlinePassed and attending', async () => {
      const user = userEvent.setup();

      mockSubmitEventRsvp.mockResolvedValue({
        attendanceStatus: 'attending',
      });

      renderForm({ eventType: 'rehearsal', deadlinePassed: true });

      await user.click(screen.getByText('Yes, I will attend'));
      await user.click(screen.getByText('Alice E2E'));

      await user.click(screen.getByRole('button', { name: /Submit RSVP/i }));

      await waitFor(() => {
        expect(mockSubmitEventRsvp).toHaveBeenCalledWith(
          expect.objectContaining({ attendanceStatus: 'attending' }),
        );
      });
    });
  });
});
