import { expect, test, describe, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InvitationCodeForm, formatInvitationCode } from './InvitationCodeForm';

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

      // Type a 3-letter word only — formatter produces 'bad' (no hyphen), which fails the schema
      await user.type(screen.getByLabelText('Invitation Code'), 'bad');
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

      await user.type(screen.getByLabelText('Invitation Code'), 'swifpand');
      await user.click(
        screen.getByRole('button', { name: 'Continue to RSVP' }),
      );

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith(
          'invitation-code',
          expect.objectContaining({ invitationCode: 'swif-pand' }),
        );
      });
    });

    test('should redirect to /rsvp on successful sign in', async () => {
      const user = userEvent.setup();

      mockSignIn.mockResolvedValue({ ok: true, error: null });

      renderForm();

      await user.type(screen.getByLabelText('Invitation Code'), 'swifpand');
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

      await user.type(screen.getByLabelText('Invitation Code'), 'swifpand');
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

      await user.type(screen.getByLabelText('Invitation Code'), 'swifpand');
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

      await user.type(screen.getByLabelText('Invitation Code'), 'swifpand');
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

      await user.type(screen.getByLabelText('Invitation Code'), 'SwifPand');
      await user.click(
        screen.getByRole('button', { name: 'Continue to RSVP' }),
      );

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith(
          'invitation-code',
          expect.objectContaining({ invitationCode: 'swif-pand' }),
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

      renderForm('swif-pand');

      // Overlay not visible before typing finishes
      expect(
        screen.queryByText('Validating invitation code\u2026'),
      ).not.toBeInTheDocument();

      // Advance past typing (9 chars * 80ms + 300ms base = 1020ms) + overlay delay (200ms) = 1220ms
      await act(async () => {
        vi.advanceTimersByTime(1400);
      });

      expect(
        screen.getByText('Validating invitation code\u2026'),
      ).toBeInTheDocument();
    });

    test('should show the full code in the input after typing completes', async () => {
      mockSignIn.mockResolvedValue({ ok: true, error: null });

      renderForm('swif-pand');

      await act(async () => {
        vi.advanceTimersByTime(1200);
      });

      expect(screen.getByLabelText('Invitation Code')).toHaveValue('swif-pand');
    });

    test('should not call signIn before typing and delay complete', async () => {
      mockSignIn.mockResolvedValue({ ok: true, error: null });

      renderForm('swif-pand');

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(mockSignIn).not.toHaveBeenCalled();
    });

    test('should call signIn with the code after the full animation sequence', async () => {
      mockSignIn.mockResolvedValue({ ok: true, error: null });

      renderForm('swif-pand');

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockSignIn).toHaveBeenCalledWith(
        'invitation-code',
        expect.objectContaining({ invitationCode: 'swif-pand' }),
      );
    });

    test('should not auto-submit a second time if component re-renders', async () => {
      mockSignIn.mockResolvedValue({ ok: true, error: null });

      const { rerender } = render(
        <InvitationCodeForm
          marcellusClassName="test-font"
          initialCode="swif-pand"
        />,
      );

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      rerender(
        <InvitationCodeForm
          marcellusClassName="test-font"
          initialCode="swif-pand"
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

  describe('recovery link in error state (US2)', () => {
    test('should show inline "Missing your code?" link when code-not-recognised error is set by signIn', async () => {
      const user = userEvent.setup();

      mockSignIn.mockResolvedValue({ ok: false, error: 'CredentialsSignin' });

      renderForm();

      await user.type(screen.getByLabelText('Invitation Code'), 'fakecode');
      await user.click(
        screen.getByRole('button', { name: 'Continue to RSVP' }),
      );

      const recoveryLink = await screen.findByRole('link', {
        name: /missing your code\?/i,
      });

      expect(recoveryLink).toBeInTheDocument();
      expect(recoveryLink).toHaveAttribute('href', '/rsvp/recover');
    });

    test('should show inline "Missing your code?" link when ?error=CredentialsSignin URL param is present', () => {
      mockSearchParamsGet.mockImplementation((key: string) =>
        key === 'error' ? 'CredentialsSignin' : null,
      );

      renderForm();

      const recoveryLink = screen.getByRole('link', {
        name: /missing your code\?/i,
      });

      expect(recoveryLink).toBeInTheDocument();
      expect(recoveryLink).toHaveAttribute('href', '/rsvp/recover');
    });

    test('should NOT show inline "Missing your code?" link when a generic sign-in error occurs', async () => {
      const user = userEvent.setup();

      mockSignIn.mockRejectedValue(new Error('Network error'));

      renderForm();

      await user.type(screen.getByLabelText('Invitation Code'), 'swift-panda');
      await user.click(
        screen.getByRole('button', { name: 'Continue to RSVP' }),
      );

      await screen.findByText(
        'An error occurred during sign in. Please try again.',
      );

      expect(
        screen.queryByRole('link', { name: /missing your code\?/i }),
      ).not.toBeInTheDocument();
    });

    test('should NOT show inline "Missing your code?" link when there is no error', () => {
      renderForm();

      expect(
        screen.queryByRole('link', { name: /missing your code\?/i }),
      ).not.toBeInTheDocument();
    });
  });

  // US1: Auto-format formatter unit tests (TDD — written before implementation)
  describe('formatInvitationCode (US1)', () => {
    test('should append hyphen automatically after 4 letters (auto-hyphen at boundary)', () => {
      const result = formatInvitationCode('swif', '', 4);

      expect(result.formatted).toBe('swif-');
      expect(result.cursorPosition).toBe(5);
    });

    test('should position cursor at WORD_LENGTH + 1 after auto-hyphen insertion', () => {
      const result = formatInvitationCode('swif', '', 4);

      expect(result.cursorPosition).toBe(5);
    });

    test('should silently drop first-segment characters beyond word length', () => {
      const result = formatInvitationCode('swiftt', '', 4);

      // 5th+ chars of first segment overflow into second segment
      expect(result.formatted).toBe('swif-tt');
    });

    test('should silently drop characters when both words are at max length', () => {
      const result = formatInvitationCode('swiftpanda', '', 4);

      // letters = swiftpanda → first = swif, second = tpan (capped at 4)
      expect(result.formatted).toBe('swif-tpan');
      expect(result.cursorPosition).toBe('swif-tpan'.length);
    });

    test('should strip non-letter characters from input (FR-007)', () => {
      const result = formatInvitationCode('sw1f', '', 4);

      expect(result.formatted).toBe('swf');
    });

    test('should absorb manual hyphen at boundary when auto-hyphen already present (FR-005/EC-1)', () => {
      // User types '-' when 'swif-' is already in the field
      const result = formatInvitationCode('swif-', 'swif-', 4);

      expect(result.formatted).toBe('swif-');
    });

    test('should silently strip manual hyphen typed mid-first-word', () => {
      // User types 'sw-f' (hyphen mid-word)
      const result = formatInvitationCode('sw-f', 'sw', 4);

      expect(result.formatted).toBe('swf');
      expect(result.cursorPosition).toBe(3);
    });

    test('should pass through mixed-case input unchanged by the formatter', () => {
      const result = formatInvitationCode('Swif', '', 4);

      expect(result.formatted).toBe('Swif-');
      expect(result.cursorPosition).toBe(5);
    });

    test('should return correct formatted string when second word is partially typed', () => {
      const result = formatInvitationCode('swif-pa', 'swif-p', 4);

      expect(result.formatted).toBe('swif-pa');
      expect(result.cursorPosition).toBe('swif-pa'.length);
    });
  });

  // US1: Component integration tests (TDD — written before implementation)
  describe('auto-format on typing (US1)', () => {
    test('should produce word- in the input after typing 4 letters', async () => {
      const user = userEvent.setup();

      renderForm();

      const input = screen.getByLabelText('Invitation Code');

      await user.type(input, 'swif');

      expect(input).toHaveValue('swif-');
    });

    test('should allow typing letters after the auto-inserted hyphen', async () => {
      const user = userEvent.setup();

      renderForm();

      const input = screen.getByLabelText('Invitation Code');

      await user.type(input, 'swifpand');

      expect(input).toHaveValue('swif-pand');
    });

    test('should submit the form with word-word format unchanged (FR-001, FR-002, FR-003)', async () => {
      const user = userEvent.setup();

      mockSignIn.mockResolvedValue({ ok: true, error: null });

      renderForm();

      const input = screen.getByLabelText('Invitation Code');

      await user.type(input, 'swifpand');
      await user.click(
        screen.getByRole('button', { name: 'Continue to RSVP' }),
      );

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith(
          'invitation-code',
          expect.objectContaining({ invitationCode: 'swif-pand' }),
        );
      });
    });
  });

  // US2: Backspace-Through-Hyphen formatter tests (TDD — written before implementation)
  describe('formatInvitationCode backspace detection (US2)', () => {
    test('should suppress hyphen re-insertion when deletedHyphen flag is true', () => {
      // prevValue = 'swif-', rawValue = 'swif' (user backspaced the hyphen)
      const result = formatInvitationCode('swif', 'swif-', 4);

      expect(result.formatted).toBe('swif');
    });

    test('should allow sequential backspace through full code (US2 step sequence)', () => {
      const steps = [
        { raw: 'swif-pan', prev: 'swif-pand', expected: 'swif-pan' },
        { raw: 'swif-pa', prev: 'swif-pan', expected: 'swif-pa' },
        { raw: 'swif-p', prev: 'swif-pa', expected: 'swif-p' },
        { raw: 'swif-', prev: 'swif-p', expected: 'swif-' },
        { raw: 'swif', prev: 'swif-', expected: 'swif' }, // deletes hyphen — no re-insertion
        { raw: 'swi', prev: 'swif', expected: 'swi' },
        { raw: 'sw', prev: 'swi', expected: 'sw' },
      ];

      steps.forEach(({ raw, prev, expected }) => {
        const result = formatInvitationCode(raw, prev, 4);
        expect(result.formatted).toBe(expected);
      });
    });
  });

  // US2: Component integration test
  describe('backspace through auto-dash (US2)', () => {
    test('should remove dash on single backspace and not re-insert it', async () => {
      const user = userEvent.setup();

      renderForm();

      const input = screen.getByLabelText('Invitation Code');

      // Type 4 letters to trigger auto-hyphen
      await user.type(input, 'swif');
      expect(input).toHaveValue('swif-');

      // Backspace once — dash should disappear
      await user.keyboard('{Backspace}');
      expect(input).toHaveValue('swif');

      // Backspace again — last letter removed, no dash re-inserted
      await user.keyboard('{Backspace}');
      expect(input).toHaveValue('swi');
    });
  });

  // US3: Paste behavior tests (TDD — written before implementation)
  describe('paste behavior (US3)', () => {
    test('should accept a full word-word paste without double-hyphen (FR-005)', async () => {
      const user = userEvent.setup();

      renderForm();

      const input = screen.getByLabelText('Invitation Code');

      await user.click(input);
      await user.paste('swif-pand');

      expect(input).toHaveValue('swif-pand');
    });

    test('should normalise a letter-only paste by inserting the hyphen', async () => {
      const user = userEvent.setup();

      renderForm();

      const input = screen.getByLabelText('Invitation Code');

      await user.click(input);
      await user.paste('swifpand');

      expect(input).toHaveValue('swif-pand');
    });

    test('should truncate an over-length paste to (WORD_LENGTH * 2 + 1) characters', async () => {
      const user = userEvent.setup();

      renderForm();

      const input = screen.getByLabelText('Invitation Code');

      await user.click(input);
      await user.paste('swifpandaxyz');

      // letters = swifpandaxyz → first=swif, second=pand → swif-pand (max 9 chars)
      expect(input).toHaveValue('swif-pand');
    });
  });

  // US4: Helper text (TDD — written before implementation)
  describe('helper text (US4)', () => {
    test('should render the helper text below the invitation code input', () => {
      renderForm();

      expect(
        screen.getByText(
          'Your code is printed on the insert inside your invitation envelope.',
        ),
      ).toBeInTheDocument();
    });

    test('should link input to hint via aria-describedby and matching id', () => {
      renderForm();

      const input = screen.getByLabelText('Invitation Code');

      expect(input).toHaveAttribute('aria-describedby', 'invitation-code-hint');
      expect(
        // eslint-disable-next-line testing-library/no-node-access
        document.getElementById('invitation-code-hint'),
      ).toBeInTheDocument();
    });

    test('should still render the "Missing or lost your invitation code?" recovery link', () => {
      renderForm();

      const recoveryLink = screen.getByRole('link', {
        name: /missing or lost your invitation code\?/i,
      });

      expect(recoveryLink).toBeInTheDocument();
      expect(recoveryLink).toHaveAttribute('href', '/rsvp/recover');
    });
  });
});
