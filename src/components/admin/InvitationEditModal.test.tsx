import { expect, test, describe, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvitationEditModal from './InvitationEditModal';
import type { InvitationEditFormData } from '@/lib/schemas/invitation';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRouterRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
}));

const mockUpdateInvitationDetails = vi.fn();

vi.mock('@/app/admin/invitations/actions', () => ({
  updateInvitationDetails: (...args: unknown[]) =>
    mockUpdateInvitationDetails(...args),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const defaultValues: InvitationEditFormData = {
  mailingAddress: 'The Smith Family',
  relationshipToCouple: 'Family',
  totalInvited: 4,
  invitationCode: 'swift-panda',
  address: '123 Main St',
  addressLine2: '',
  city: 'Springfield',
  state: 'IL',
  zipCode: '62701',
  country: 'USA',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('InvitationEditModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should pre-populate the form with the invitation data', () => {
    render(
      <InvitationEditModal
        invitationId="inv-1"
        defaultValues={defaultValues}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/mailing address/i)).toHaveValue(
      'The Smith Family',
    );
    expect(screen.getByLabelText(/total invited/i)).toHaveValue(4);
    expect(screen.getByLabelText(/invitation code/i)).toHaveValue(
      'swift-panda',
    );
    expect(screen.getByLabelText(/^street address/i)).toHaveValue(
      '123 Main St',
    );
  });

  test('should show a validation error and not call the server action when mailing address is cleared', async () => {
    const user = userEvent.setup();
    render(
      <InvitationEditModal
        invitationId="inv-1"
        defaultValues={defaultValues}
        onClose={vi.fn()}
      />,
    );

    await user.clear(screen.getByLabelText(/mailing address/i));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(
      await screen.findByText('Mailing address is required'),
    ).toBeInTheDocument();
    expect(mockUpdateInvitationDetails).not.toHaveBeenCalled();
  });

  test('should show a validation error when total invited is below 1', async () => {
    const user = userEvent.setup();
    render(
      <InvitationEditModal
        invitationId="inv-1"
        defaultValues={defaultValues}
        onClose={vi.fn()}
      />,
    );

    await user.clear(screen.getByLabelText(/total invited/i));
    await user.type(screen.getByLabelText(/total invited/i), '0');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(
      await screen.findByText('Must invite at least 1 guest'),
    ).toBeInTheDocument();
    expect(mockUpdateInvitationDetails).not.toHaveBeenCalled();
  });

  test('should submit the edited data and refresh on success', async () => {
    mockUpdateInvitationDetails.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(
      <InvitationEditModal
        invitationId="inv-1"
        defaultValues={defaultValues}
        onClose={vi.fn()}
      />,
    );

    await user.clear(screen.getByLabelText(/mailing address/i));
    await user.type(
      screen.getByLabelText(/mailing address/i),
      'The Smith-Jones Family',
    );
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateInvitationDetails).toHaveBeenCalledWith(
        'inv-1',
        expect.objectContaining({ mailingAddress: 'The Smith-Jones Family' }),
      );
    });
    expect(mockRouterRefresh).toHaveBeenCalled();
  });

  test('should display the server error and keep the modal open on failure', async () => {
    mockUpdateInvitationDetails.mockResolvedValue({
      success: false,
      error: 'That invitation code is already in use',
    });
    const user = userEvent.setup();
    render(
      <InvitationEditModal
        invitationId="inv-1"
        defaultValues={defaultValues}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(
      await screen.findByText('That invitation code is already in use'),
    ).toBeInTheDocument();
    expect(mockRouterRefresh).not.toHaveBeenCalled();
  });

  test('should call onClose when Cancel is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <InvitationEditModal
        invitationId="inv-1"
        defaultValues={defaultValues}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).toHaveBeenCalled();
  });
});
