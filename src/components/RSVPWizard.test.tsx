import { expect, test, describe, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  RSVPWizard,
  type InvitationAddress,
  type RSVPWizardProps,
} from './RSVPWizard';
import type { WeddingEvent, RsvpResponse } from '@/lib/db/schema';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRouterRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
}));

const mockUpdateInvitationAddress = vi.fn();

vi.mock('@/app/rsvp/(portal)/actions', () => ({
  updateInvitationAddress: (...args: unknown[]) =>
    mockUpdateInvitationAddress(...args),
  submitRsvp: vi.fn().mockResolvedValue({ success: true }),
}));

// Stub RSVPForm so wizard navigation tests stay focused on the wizard itself.
// The RSVPForm's own behaviour is tested separately via its server action tests.
vi.mock('@/components/RSVPForm', () => ({
  RSVPForm: ({ onSubmitSuccess }: { onSubmitSuccess?: () => void }) => (
    <div>
      <span data-testid="rsvp-form">RSVPForm</span>
      <button type="button" onClick={onSubmitSuccess}>
        Submit RSVP
      </button>
    </div>
  ),
}));

vi.mock('@/components/EventRsvpCard', () => ({
  EventRsvpCard: ({ event }: { event: WeddingEvent }) => (
    <div data-testid={`event-card-${event.id}`}>{event.name}</div>
  ),
}));

vi.mock('@/lib/rsvp', () => ({
  isDeadlinePassed: () => false,
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const FULL_ADDRESS: InvitationAddress = {
  mailingAddress: 'The Smith Family',
  address: '123 Main St',
  addressLine2: null,
  city: 'Boston',
  state: 'MA',
  zipCode: '02101',
};

const EMPTY_ADDRESS: InvitationAddress = {
  mailingAddress: null,
  address: null,
  addressLine2: null,
  city: null,
  state: null,
  zipCode: null,
};

const BASE_GUEST = {
  id: 'guest-1',
  firstName: 'Jane',
  lastName: 'Smith',
  type: 'adult' as const,
  attending: null,
  mealChoice: null,
  dietaryRestrictions: null,
  notes: null,
};

/**
 * Creates a minimal WeddingEvent fixture.
 *
 * @param overrides - Partial fields to override defaults.
 */
function makeEvent(overrides: Partial<WeddingEvent> = {}): WeddingEvent {
  return {
    id: 'event-1',
    name: 'Rehearsal Dinner',
    description: null,
    location: 'The Grand Hall',
    eventDate: '2026-09-11',
    startTime: '18:00',
    endTime: '21:00',
    type: 'rehearsal',
    dressCode: null,
    parkingInfo: null,
    locationLat: null,
    locationLng: null,
    sortOrder: 1,
    rsvpRequired: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a minimal RSVPWizardProps fixture.
 *
 * @param overrides - Partial props to override defaults.
 */
function makeProps(overrides: Partial<RSVPWizardProps> = {}): RSVPWizardProps {
  return {
    invitationId: 'invitation-1',
    address: FULL_ADDRESS,
    guests: [BASE_GUEST],
    isSubmitted: false,
    submittedAt: null,
    contactEmail: null,
    additionalEvents: [],
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('RSVPWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateInvitationAddress.mockResolvedValue({ success: true });
  });

  describe('step indicator', () => {
    test('should render all three step labels', () => {
      render(<RSVPWizard {...makeProps()} />);

      expect(screen.getByText('Confirm Address')).toBeInTheDocument();
      expect(screen.getByText('Your RSVP')).toBeInTheDocument();
      expect(screen.getByText('Additional Events')).toBeInTheDocument();
    });

    test('should show step 1 as active on first visit', () => {
      render(<RSVPWizard {...makeProps({ isSubmitted: false })} />);

      expect(screen.getByText('Confirm Your Address')).toBeInTheDocument();
    });

    test('should show step 2 as active for returning guests', () => {
      render(
        <RSVPWizard
          {...makeProps({
            isSubmitted: true,
            submittedAt: '2026-03-01T12:00:00Z',
          })}
        />,
      );

      expect(screen.getByTestId('rsvp-form')).toBeInTheDocument();
      expect(
        screen.queryByText('Confirm Your Address'),
      ).not.toBeInTheDocument();
    });
  });

  describe('step 1 — address confirmation', () => {
    test('should display the invitation address', () => {
      render(<RSVPWizard {...makeProps()} />);

      expect(screen.getByText('The Smith Family')).toBeInTheDocument();
      expect(screen.getByText('123 Main St')).toBeInTheDocument();
      expect(screen.getByText(/Boston, MA/)).toBeInTheDocument();
    });

    test('should show "No address on file" when address is empty', () => {
      render(<RSVPWizard {...makeProps({ address: EMPTY_ADDRESS })} />);

      expect(screen.getByText('No address on file.')).toBeInTheDocument();
    });

    test('should advance to step 2 when confirming the address', async () => {
      const user = userEvent.setup();

      render(<RSVPWizard {...makeProps()} />);

      await user.click(
        screen.getByRole('button', { name: 'Looks correct — continue' }),
      );

      expect(screen.getByTestId('rsvp-form')).toBeInTheDocument();
    });

    test('should show the "Something looks wrong?" link', () => {
      render(<RSVPWizard {...makeProps()} />);

      expect(
        screen.getByRole('button', {
          name: 'Something looks wrong? Update address',
        }),
      ).toBeInTheDocument();
    });
  });

  describe('step 1 — address editing', () => {
    test('should reveal the edit form when "Something looks wrong?" is clicked', async () => {
      const user = userEvent.setup();

      render(<RSVPWizard {...makeProps()} />);

      await user.click(
        screen.getByRole('button', {
          name: 'Something looks wrong? Update address',
        }),
      );

      expect(screen.getByText('Update your address:')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('123 Main St')).toBeInTheDocument();
    });

    test('should pre-fill edit fields with existing address values', async () => {
      const user = userEvent.setup();

      render(<RSVPWizard {...makeProps()} />);

      await user.click(
        screen.getByRole('button', {
          name: 'Something looks wrong? Update address',
        }),
      );

      expect(screen.getByPlaceholderText('e.g., The Smith Family')).toHaveValue(
        'The Smith Family',
      );
      expect(screen.getByPlaceholderText('123 Main St')).toHaveValue(
        '123 Main St',
      );
      expect(screen.getByPlaceholderText('Boston')).toHaveValue('Boston');
      expect(screen.getByPlaceholderText('MA')).toHaveValue('MA');
      expect(screen.getByPlaceholderText('02101')).toHaveValue('02101');
    });

    test('should hide the edit form when Cancel is clicked', async () => {
      const user = userEvent.setup();

      render(<RSVPWizard {...makeProps()} />);

      await user.click(
        screen.getByRole('button', {
          name: 'Something looks wrong? Update address',
        }),
      );

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(
        screen.queryByText('Update your address:'),
      ).not.toBeInTheDocument();
    });

    test('should save edited address and return to confirm view', async () => {
      const user = userEvent.setup();

      render(<RSVPWizard {...makeProps()} />);

      await user.click(
        screen.getByRole('button', {
          name: 'Something looks wrong? Update address',
        }),
      );

      const streetInput = screen.getByPlaceholderText('123 Main St');

      await user.clear(streetInput);
      await user.type(streetInput, '456 Oak Ave');

      await user.click(screen.getByRole('button', { name: 'Save & Continue' }));

      await waitFor(() => {
        expect(mockUpdateInvitationAddress).toHaveBeenCalledWith(
          expect.objectContaining({
            invitationId: 'invitation-1',
            address: '456 Oak Ave',
          }),
        );
      });

      // Should return to confirm view, not advance to step 2 immediately.
      expect(
        screen.getByRole('button', { name: /Looks correct/i }),
      ).toBeInTheDocument();
      expect(screen.queryByTestId('rsvp-form')).not.toBeInTheDocument();
    });

    test('should advance to step 2 after confirming the saved address', async () => {
      const user = userEvent.setup();

      render(<RSVPWizard {...makeProps()} />);

      await user.click(
        screen.getByRole('button', {
          name: 'Something looks wrong? Update address',
        }),
      );

      await user.click(screen.getByRole('button', { name: 'Save & Continue' }));

      await waitFor(() => {
        expect(mockUpdateInvitationAddress).toHaveBeenCalledTimes(1);
      });

      // Now confirm from the confirm view to advance to step 2.
      await user.click(screen.getByRole('button', { name: /Looks correct/i }));

      await waitFor(() => {
        expect(screen.getByTestId('rsvp-form')).toBeInTheDocument();
      });
    });

    test('should show an error message when saving the address fails', async () => {
      const user = userEvent.setup();

      mockUpdateInvitationAddress.mockRejectedValue(new Error('Network error'));

      render(<RSVPWizard {...makeProps()} />);

      await user.click(
        screen.getByRole('button', {
          name: 'Something looks wrong? Update address',
        }),
      );

      await user.click(screen.getByRole('button', { name: 'Save & Continue' }));

      expect(await screen.findByText('Network error')).toBeInTheDocument();
      expect(screen.queryByTestId('rsvp-form')).not.toBeInTheDocument();
    });

    test('should show an error message when confirming the existing address fails', async () => {
      const user = userEvent.setup();

      mockUpdateInvitationAddress.mockRejectedValue(new Error('Server error'));

      render(<RSVPWizard {...makeProps()} />);

      // Click the confirm button without opening the edit form
      await user.click(
        screen.getByRole('button', { name: 'Looks correct \u2014 continue' }),
      );

      expect(await screen.findByText('Server error')).toBeInTheDocument();
      expect(screen.queryByTestId('rsvp-form')).not.toBeInTheDocument();
    });

    test('should show an inline email error and not call the server when confirm is clicked with an invalid email', async () => {
      const user = userEvent.setup();

      render(<RSVPWizard {...makeProps()} />);

      await user.clear(screen.getByLabelText(/Contact Email/i));
      await user.type(screen.getByLabelText(/Contact Email/i), 'not-an-email');
      await user.click(
        screen.getByRole('button', { name: 'Looks correct \u2014 continue' }),
      );

      expect(
        await screen.findByText('Please enter a valid email address'),
      ).toBeInTheDocument();
      expect(mockUpdateInvitationAddress).not.toHaveBeenCalled();
      expect(screen.queryByTestId('rsvp-form')).not.toBeInTheDocument();
    });

    test('should show an inline email error and not call the server when Save & Continue is clicked with an invalid email', async () => {
      const user = userEvent.setup();

      render(<RSVPWizard {...makeProps()} />);

      await user.click(
        screen.getByRole('button', {
          name: 'Something looks wrong? Update address',
        }),
      );

      await user.clear(screen.getByLabelText(/Contact Email/i));
      await user.type(screen.getByLabelText(/Contact Email/i), 'bad@@email');
      await user.click(screen.getByRole('button', { name: 'Save & Continue' }));

      expect(
        await screen.findByText('Please enter a valid email address'),
      ).toBeInTheDocument();
      expect(mockUpdateInvitationAddress).not.toHaveBeenCalled();
    });

    test('should clear the email error when the user corrects the email', async () => {
      const user = userEvent.setup();

      render(<RSVPWizard {...makeProps()} />);

      // Trigger the validation error
      await user.type(screen.getByLabelText(/Contact Email/i), 'not-an-email');
      await user.click(
        screen.getByRole('button', { name: 'Looks correct \u2014 continue' }),
      );

      expect(
        await screen.findByText('Please enter a valid email address'),
      ).toBeInTheDocument();

      // Start typing to correct it — error should clear immediately
      await user.clear(screen.getByLabelText(/Contact Email/i));

      expect(
        screen.queryByText('Please enter a valid email address'),
      ).not.toBeInTheDocument();
    });

    test('should show "Saving…" while the save request is in-flight', async () => {
      const user = userEvent.setup();

      let resolve!: (v: { success: boolean }) => void;

      mockUpdateInvitationAddress.mockImplementation(
        () =>
          new Promise<{ success: boolean }>((res) => {
            resolve = res;
          }),
      );

      render(<RSVPWizard {...makeProps()} />);

      await user.click(
        screen.getByRole('button', {
          name: 'Something looks wrong? Update address',
        }),
      );

      await user.click(screen.getByRole('button', { name: 'Save & Continue' }));

      expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();

      // Flush pending state updates before the test ends to avoid act() warnings
      await act(async () => {
        resolve({ success: true });
      });
    });
  });

  describe('step 2 — RSVP form', () => {
    test('should render the RSVP form on step 2', async () => {
      const user = userEvent.setup();

      render(<RSVPWizard {...makeProps()} />);

      await user.click(
        screen.getByRole('button', { name: 'Looks correct — continue' }),
      );

      expect(screen.getByTestId('rsvp-form')).toBeInTheDocument();
    });

    test('should show a back link to address step', async () => {
      const user = userEvent.setup();

      render(<RSVPWizard {...makeProps()} />);

      await user.click(
        screen.getByRole('button', { name: 'Looks correct — continue' }),
      );

      expect(
        screen.getByRole('button', { name: '← Back to address' }),
      ).toBeInTheDocument();
    });

    test('should return to step 1 when "← Back to address" is clicked', async () => {
      const user = userEvent.setup();

      render(<RSVPWizard {...makeProps()} />);

      await user.click(
        screen.getByRole('button', { name: 'Looks correct — continue' }),
      );

      await user.click(
        screen.getByRole('button', { name: '← Back to address' }),
      );

      expect(screen.getByText('Confirm Your Address')).toBeInTheDocument();
      expect(screen.queryByTestId('rsvp-form')).not.toBeInTheDocument();
    });

    test('should advance to step 3 after RSVP is submitted', async () => {
      const user = userEvent.setup();

      render(<RSVPWizard {...makeProps()} />);

      await user.click(
        screen.getByRole('button', { name: 'Looks correct — continue' }),
      );

      await user.click(screen.getByRole('button', { name: 'Submit RSVP' }));

      expect(
        screen.getByRole('heading', { name: 'Additional Events' }),
      ).toBeInTheDocument();
      expect(screen.queryByTestId('rsvp-form')).not.toBeInTheDocument();
    });
  });

  describe('step 3 — additional events', () => {
    test('should show an all-done message when there are no additional events', async () => {
      const user = userEvent.setup();

      render(<RSVPWizard {...makeProps({ additionalEvents: [] })} />);

      await user.click(
        screen.getByRole('button', { name: 'Looks correct — continue' }),
      );

      await user.click(screen.getByRole('button', { name: 'Submit RSVP' }));

      expect(screen.getByText("🎉 You're all set!")).toBeInTheDocument();
    });

    test('should render event cards for each additional event', async () => {
      const user = userEvent.setup();

      const events = [
        {
          event: makeEvent({ id: 'event-1', name: 'Rehearsal Dinner' }),
          rsvp: null,
        },
        {
          event: makeEvent({ id: 'event-2', name: 'Welcome Brunch' }),
          rsvp: {
            id: 'rsvp-1',
            attendanceStatus: 'attending',
          } as unknown as RsvpResponse,
        },
      ];

      render(<RSVPWizard {...makeProps({ additionalEvents: events })} />);

      await user.click(
        screen.getByRole('button', { name: 'Looks correct — continue' }),
      );

      await user.click(screen.getByRole('button', { name: 'Submit RSVP' }));

      expect(screen.getByTestId('event-card-event-1')).toBeInTheDocument();
      expect(screen.getByTestId('event-card-event-2')).toBeInTheDocument();
    });

    test('should return to step 2 when "← Back to RSVP" is clicked', async () => {
      const user = userEvent.setup();

      render(<RSVPWizard {...makeProps()} />);

      await user.click(
        screen.getByRole('button', { name: 'Looks correct — continue' }),
      );

      await user.click(screen.getByRole('button', { name: 'Submit RSVP' }));

      await user.click(screen.getByRole('button', { name: '← Back to RSVP' }));

      expect(screen.getByTestId('rsvp-form')).toBeInTheDocument();
    });
  });
});
