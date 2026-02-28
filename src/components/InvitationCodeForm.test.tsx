import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InvitationCodeForm } from './InvitationCodeForm';

const mockRouterPush = vi.fn();
const mockSearchParamsGet = vi.fn();
const mockSignIn = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
}));

vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

/**
 * Renders the InvitationCodeForm with a no-op font class.
 *
 * @param initialCode - Optional deep-link code pre-fill.
 */
function renderForm(initialCode?: string) {
  render(
    <InvitationCodeForm
      marcellusClassName="test-font"
      initialCode={initialCode}
    />,
  );
}

describe('InvitationCodeForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: no error, no callbackUrl in query string
    mockSearchParamsGet.mockReturnValue(null);
  });

  describe('default rendering', () => {
    test('should render the heading and subtitle', () => {
      renderForm();

      expect(screen.getByText("You're Invited")).toBeInTheDocument();
      expect(
        screen.getByText('Enter your invitation code to continue'),
      ).toBeInTheDocument();
    });

    test('should render the invitation code input', () => {
      renderForm();

      expect(screen.getByLabelText('Invitation Code')).toBeInTheDocument();
    });

    test('should render the submit button', () => {
      renderForm();

      expect(
        screen.getByRole('button', { name: 'Continue to RSVP' }),
      ).toBeInTheDocument();
    });

    test('should not show an error banner by default', () => {
      renderForm();

      expect(
        screen.queryByText(/That code wasn't recognised/),
      ).not.toBeInTheDocument();
    });
  });

  describe('URL error state', () => {
    test('should show error banner when ?error=CredentialsSignin is present', () => {
      mockSearchParamsGet.mockImplementation((key: string) =>
        key === 'error' ? 'CredentialsSignin' : null,
      );

      renderForm();

      expect(
        screen.getByText(
          "That code wasn't recognised. Please check your invitation and try again.",
        ),
      ).toBeInTheDocument();
    });

    test('should show error banner when ?error=Signin is present', () => {
      mockSearchParamsGet.mockImplementation((key: string) =>
        key === 'error' ? 'Signin' : null,
      );

      renderForm();

      expect(
        screen.getByText(
          "That code wasn't recognised. Please check your invitation and try again.",
        ),
      ).toBeInTheDocument();
    });
  });

  describe('form validation', () => {
    test('should show required error when submitting an empty form', async () => {
      const user = userEvent.setup();

      renderForm();

      await user.click(
        screen.getByRole('button', { name: 'Continue to RSVP' }),
      );

      expect(
        await screen.findByText('Invitation code is required'),
      ).toBeInTheDocument();
    });

    test('should show format error when code does not match word-word pattern', async () => {
      const user = userEvent.setup();

      renderForm();

      await user.type(screen.getByLabelText('Invitation Code'), 'badformat');
      await user.click(
        screen.getByRole('button', { name: 'Continue to RSVP' }),
      );

      expect(
        await screen.findByText(
          'Code should be in the format "word-word" (e.g. swift-panda)',
        ),
      ).toBeInTheDocument();
    });

    test('should not call signIn when the form is invalid', async () => {
      const user = userEvent.setup();

      renderForm();

      await user.click(
        screen.getByRole('button', { name: 'Continue to RSVP' }),
      );

      expect(mockSignIn).not.toHaveBeenCalled();
    });
  });

  describe('manual form submission', () => {
    test('should call signIn with the entered code', async () => {
      const user = userEvent.setup();

      mockSignIn.mockResolvedValue({ ok: true, error: null });

      renderForm();

      await user.type(screen.getByLabelText('Invitation Code'), 'swift-panda');
      await user.click(
        screen.getByRole('button', { name: 'Continue to RSVP' }),
      );

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith(
          'invitation-code',
          expect.objectContaining({ invitationCode: 'swift-panda' }),
        );
      });
    });

    test('should redirect to /rsvp on successful sign in', async () => {
      const user = userEvent.setup();

      mockSignIn.mockResolvedValue({ ok: true, error: null });

      renderForm();

      await user.type(screen.getByLabelText('Invitation Code'), 'swift-panda');
      await user.click(
        screen.getByRole('button', { name: 'Continue to RSVP' }),
      );

      await waitFor(() => {
        expect(mockRouterPush).toHaveBeenCalledWith('/rsvp');
      });
    });

    test('should use callbackUrl from query params when present', async () => {
      const user = userEvent.setup();

      mockSearchParamsGet.mockImplementation((key: string) =>
        key === 'callbackUrl' ? '/rsvp/event-123' : null,
      );
      mockSignIn.mockResolvedValue({ ok: true, error: null });

      renderForm();

      await user.type(screen.getByLabelText('Invitation Code'), 'swift-panda');
      await user.click(
        screen.getByRole('button', { name: 'Continue to RSVP' }),
      );

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith(
          'invitation-code',
          expect.objectContaining({ callbackUrl: '/rsvp/event-123' }),
        );
      });
    });

    test('should show error message when signIn returns an error', async () => {
      const user = userEvent.setup();

      mockSignIn.mockResolvedValue({
        ok: false,
        error: 'CredentialsSignin',
      });

      renderForm();

      await user.type(screen.getByLabelText('Invitation Code'), 'swift-panda');
      await user.click(
        screen.getByRole('button', { name: 'Continue to RSVP' }),
      );

      expect(
        await screen.findByText(
          "That code wasn't recognised. Please check your invitation and try again.",
        ),
      ).toBeInTheDocument();
    });

    test('should show generic error message when signIn throws', async () => {
      const user = userEvent.setup();

      mockSignIn.mockRejectedValue(new Error('Network error'));

      renderForm();

      await user.type(screen.getByLabelText('Invitation Code'), 'swift-panda');
      await user.click(
        screen.getByRole('button', { name: 'Continue to RSVP' }),
      );

      expect(
        await screen.findByText(
          'An error occurred during sign in. Please try again.',
        ),
      ).toBeInTheDocument();
    });

    test('should normalise the code to lowercase before signing in', async () => {
      const user = userEvent.setup();

      mockSignIn.mockResolvedValue({ ok: true, error: null });

      renderForm();

      await user.type(screen.getByLabelText('Invitation Code'), 'Swift-Panda');
      await user.click(
        screen.getByRole('button', { name: 'Continue to RSVP' }),
      );

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith(
          'invitation-code',
          expect.objectContaining({ invitationCode: 'swift-panda' }),
        );
      });
    });
  });

  describe('deep-link auto-submit (initialCode)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test('should type the code character by character into the input', async () => {
      mockSignIn.mockResolvedValue({ ok: true, error: null });

      renderForm('ab-cd');

      // Before typing starts the field is empty
      expect(screen.getByLabelText('Invitation Code')).toHaveValue('');

      // Each char appears at 300 + index * 80ms
      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      expect(screen.getByLabelText('Invitation Code')).toHaveValue('a');

      await act(async () => {
        vi.advanceTimersByTime(80);
      });

      expect(screen.getByLabelText('Invitation Code')).toHaveValue('ab');
    });

    test('should show the validating overlay after typing completes', async () => {
      mockSignIn.mockResolvedValue({ ok: true, error: null });

      renderForm('swift-panda');

      // Overlay not visible before typing finishes
      expect(
        screen.queryByText('Validating invitation code\u2026'),
      ).not.toBeInTheDocument();

      // Advance past typing (1100ms) + overlay delay (200ms) = 1380ms
      await act(async () => {
        vi.advanceTimersByTime(1400);
      });

      expect(
        screen.getByText('Validating invitation code\u2026'),
      ).toBeInTheDocument();
    });

    test('should show the full code in the input after typing completes', async () => {
      mockSignIn.mockResolvedValue({ ok: true, error: null });

      renderForm('swift-panda');

      await act(async () => {
        vi.advanceTimersByTime(1200);
      });

      expect(screen.getByLabelText('Invitation Code')).toHaveValue(
        'swift-panda',
      );
    });

    test('should not call signIn before typing and delay complete', async () => {
      mockSignIn.mockResolvedValue({ ok: true, error: null });

      renderForm('swift-panda');

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(mockSignIn).not.toHaveBeenCalled();
    });

    test('should call signIn with the code after the full animation sequence', async () => {
      mockSignIn.mockResolvedValue({ ok: true, error: null });

      renderForm('swift-panda');

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockSignIn).toHaveBeenCalledWith(
        'invitation-code',
        expect.objectContaining({ invitationCode: 'swift-panda' }),
      );
    });

    test('should not auto-submit a second time if component re-renders', async () => {
      mockSignIn.mockResolvedValue({ ok: true, error: null });

      const { rerender } = render(
        <InvitationCodeForm
          marcellusClassName="test-font"
          initialCode="swift-panda"
        />,
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      rerender(
        <InvitationCodeForm
          marcellusClassName="test-font"
          initialCode="swift-panda"
        />,
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockSignIn).toHaveBeenCalledTimes(1);
    });

    test('should not show the validating overlay when no initialCode is provided', () => {
      renderForm();

      expect(
        screen.queryByText('Validating invitation code\u2026'),
      ).not.toBeInTheDocument();
    });
  });
});
