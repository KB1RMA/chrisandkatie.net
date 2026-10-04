import { expect, test, describe, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InvitationTable, type InvitationTableRow } from './InvitationTable';

// ─── Mocks ────────────────────────────────────────────────────────────────────
//
// This suite exercises the "Add Guest" inline form, the one part of
// InvitationTable that uses react-hook-form + @hookform/resolvers, with
// those libraries unmocked. The server actions module and next/navigation
// are mocked, matching the rest of this codebase's component tests.

const mockRouterRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
}));

const mockResetInvitationRSVP = vi.fn();
const mockUpdateGuestType = vi.fn();
const mockAddGuestToInvitation = vi.fn();
const mockRemoveGuestFromInvitation = vi.fn();
const mockUpdateInvitationVisibleEvents = vi.fn();

vi.mock('@/app/admin/invitations/actions', () => ({
  resetInvitationRSVP: (...args: unknown[]) => mockResetInvitationRSVP(...args),
  updateGuestType: (...args: unknown[]) => mockUpdateGuestType(...args),
  addGuestToInvitation: (...args: unknown[]) =>
    mockAddGuestToInvitation(...args),
  removeGuestFromInvitation: (...args: unknown[]) =>
    mockRemoveGuestFromInvitation(...args),
  updateInvitationVisibleEvents: (...args: unknown[]) =>
    mockUpdateInvitationVisibleEvents(...args),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const row: InvitationTableRow = {
  id: 'inv-1',
  invitationName: 'The Smith Family',
  relationshipToCouple: 'Family',
  totalInvited: 2,
  status: 'pending',
  attendingCount: 0,
  declinedCount: 0,
  pendingCount: 2,
  guests: [
    {
      id: 'guest-1',
      firstName: 'Alice',
      lastName: 'Smith',
      type: 'adult',
      attending: null,
      mealChoice: null,
      dietaryRestrictions: null,
      notes: null,
    },
  ],
  availableEvents: [],
  initialVisibleEventIds: [],
  searchText: 'the smith family alice smith',
  invitationCode: 'swift-panda',
  contactEmail: null,
  mailingAddress: 'The Smith Family',
  address: null,
  addressLine2: null,
  city: null,
  state: null,
  zipCode: null,
  country: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Expands the invitation row and opens the "Add Guest" inline form. */
async function openAddGuestForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /expand row/i }));
  await user.click(screen.getByRole('button', { name: /\+ add guest/i }));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('InvitationTable — Add Guest form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should show the Add Guest toggle once the row is expanded', async () => {
    const user = userEvent.setup();
    render(<InvitationTable data={[row]} />);

    await user.click(screen.getByRole('button', { name: /expand row/i }));

    expect(
      screen.getByRole('button', { name: /\+ add guest/i }),
    ).toBeInTheDocument();
  });

  test('should show validation errors and not call the server action when names are blank', async () => {
    const user = userEvent.setup();
    render(<InvitationTable data={[row]} />);

    await openAddGuestForm(user);
    await user.click(screen.getByRole('button', { name: /^add guest$/i }));

    expect(
      await screen.findByText('First name is required'),
    ).toBeInTheDocument();
    expect(screen.getByText('Last name is required')).toBeInTheDocument();
    expect(mockAddGuestToInvitation).not.toHaveBeenCalled();
  });

  test('should submit the new guest with the invitation id and default type, then collapse and refresh', async () => {
    mockAddGuestToInvitation.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<InvitationTable data={[row]} />);

    await openAddGuestForm(user);
    await user.type(screen.getByLabelText('First Name'), 'Bob');
    await user.type(screen.getByLabelText('Last Name'), 'Smith');
    await user.click(screen.getByRole('button', { name: /^add guest$/i }));

    await waitFor(() => {
      expect(mockAddGuestToInvitation).toHaveBeenCalledWith({
        invitationId: 'inv-1',
        firstName: 'Bob',
        lastName: 'Smith',
        type: 'adult',
      });
    });
    expect(mockRouterRefresh).toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: /^add guest$/i }),
    ).not.toBeInTheDocument();
  });

  test('should submit "child" when the Type select is changed', async () => {
    mockAddGuestToInvitation.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<InvitationTable data={[row]} />);

    await openAddGuestForm(user);
    await user.type(screen.getByLabelText('First Name'), 'Charlie');
    await user.type(screen.getByLabelText('Last Name'), 'Smith');
    await user.selectOptions(screen.getByLabelText('Type'), 'child');
    await user.click(screen.getByRole('button', { name: /^add guest$/i }));

    await waitFor(() => {
      expect(mockAddGuestToInvitation).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'child' }),
      );
    });
  });

  test('should show the server error and keep the form open on failure', async () => {
    mockAddGuestToInvitation.mockResolvedValue({
      success: false,
      error: 'Failed to add guest',
    });
    const user = userEvent.setup();
    render(<InvitationTable data={[row]} />);

    await openAddGuestForm(user);
    await user.type(screen.getByLabelText('First Name'), 'Bob');
    await user.type(screen.getByLabelText('Last Name'), 'Smith');
    await user.click(screen.getByRole('button', { name: /^add guest$/i }));

    expect(await screen.findByText('Failed to add guest')).toBeInTheDocument();
    expect(mockRouterRefresh).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: /^add guest$/i }),
    ).toBeInTheDocument();
  });

  test('should reset the form and close it when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<InvitationTable data={[row]} />);

    await openAddGuestForm(user);
    await user.type(screen.getByLabelText('First Name'), 'Bob');
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(
      screen.queryByRole('button', { name: /^add guest$/i }),
    ).not.toBeInTheDocument();
    expect(mockAddGuestToInvitation).not.toHaveBeenCalled();
  });
});
