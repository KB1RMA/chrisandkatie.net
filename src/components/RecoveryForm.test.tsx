import { expect, test, describe, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecoveryForm } from './RecoveryForm';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRecoverInvitationCode = vi.fn();

vi.mock('@/app/rsvp/recover/actions', () => ({
  recoverInvitationCode: (...args: unknown[]) =>
    mockRecoverInvitationCode(...args),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fills out and submits the recovery form with the given values, leaving any
 * field blank when its value is omitted.
 *
 * @param user - The userEvent instance driving interaction.
 * @param values - Field values to type before submitting.
 */
async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  values: { lastName?: string; streetAddress?: string; zipCode?: string },
) {
  if (values.lastName) {
    await user.type(screen.getByLabelText('Last Name'), values.lastName);
  }

  if (values.streetAddress) {
    await user.type(
      screen.getByLabelText('Street Address'),
      values.streetAddress,
    );
  }

  if (values.zipCode) {
    await user.type(screen.getByLabelText('ZIP Code'), values.zipCode);
  }

  await user.click(screen.getByRole('button', { name: /find my code/i }));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RecoveryForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should render the recovery form fields', () => {
    render(<RecoveryForm />);

    expect(screen.getByLabelText('Last Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Street Address')).toBeInTheDocument();
    expect(screen.getByLabelText('ZIP Code')).toBeInTheDocument();
  });

  test('should show validation errors and not call the server action when fields are blank', async () => {
    const user = userEvent.setup();
    render(<RecoveryForm />);

    await user.click(screen.getByRole('button', { name: /find my code/i }));

    expect(
      await screen.findByText('Last name is required'),
    ).toBeInTheDocument();
    expect(screen.getByText('Street address is required')).toBeInTheDocument();
    expect(screen.getByText('ZIP code is required')).toBeInTheDocument();
    expect(mockRecoverInvitationCode).not.toHaveBeenCalled();
  });

  test('should submit trimmed field values to the server action', async () => {
    mockRecoverInvitationCode.mockResolvedValue({
      success: true,
      invitationCode: 'swift-panda',
    });

    const user = userEvent.setup();
    render(<RecoveryForm />);

    await fillAndSubmit(user, {
      lastName: 'Smith',
      streetAddress: '123 Main St',
      zipCode: '62701',
    });

    await waitFor(() => {
      expect(mockRecoverInvitationCode).toHaveBeenCalledWith({
        lastName: 'Smith',
        streetAddress: '123 Main St',
        zipCode: '62701',
      });
    });
  });

  test('should reveal the invitation code on success', async () => {
    mockRecoverInvitationCode.mockResolvedValue({
      success: true,
      invitationCode: 'swift-panda',
    });

    const user = userEvent.setup();
    render(<RecoveryForm />);

    await fillAndSubmit(user, {
      lastName: 'Smith',
      streetAddress: '123 Main St',
      zipCode: '62701',
    });

    expect(await screen.findByText('swift-panda')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /sign in with this code/i }),
    ).toHaveAttribute('href', '/login?code=swift-panda');
  });

  test('should show the generic error message on failure and stay on the form', async () => {
    mockRecoverInvitationCode.mockResolvedValue({
      success: false,
      error: "We couldn't find an invitation matching those details.",
    });

    const user = userEvent.setup();
    render(<RecoveryForm />);

    await fillAndSubmit(user, {
      lastName: 'Nobody',
      streetAddress: '1 Nowhere Ln',
      zipCode: '00000',
    });

    expect(
      await screen.findByText(
        "We couldn't find an invitation matching those details.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Last Name')).toBeInTheDocument();
  });
});
