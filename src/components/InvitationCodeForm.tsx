'use client';

/**
 * Client-side invitation code login form.
 *
 * Allows guests to authenticate by entering their two-word invitation code.
 * Supports QR code deep-link auto-submission via the `initialCode` prop.
 * Uses Auth.js invitation-code credentials provider.
 */
import { signIn } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Button } from '@/components/Button';

/**
 * Zod schema for invitation code form validation.
 */
const invitationCodeSchema = z.object({
  invitationCode: z
    .string()
    .min(1, 'Invitation code is required')
    .regex(
      /^[a-z]+-[a-z]+$/i,
      'Code should be in the format "word-word" (e.g. swift-panda)',
    )
    .transform((val) => val.trim().toLowerCase()),
});

type InvitationCodeFormData = z.infer<typeof invitationCodeSchema>;

type InvitationCodeFormProps = {
  marcellusClassName: string;
  /** Pre-fill and auto-submit the form with this code (used for QR deep-links). */
  initialCode?: string;
};

/**
 * Invitation code login form component.
 *
 * @param marcellusClassName - Font class name for headings.
 * @param initialCode - Optional pre-filled code for QR deep-link auto-submission.
 */
export function InvitationCodeForm({
  marcellusClassName,
  initialCode,
}: InvitationCodeFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authError, setAuthError] = useState('');
  const [isCodeNotRecognised, setIsCodeNotRecognised] = useState(false);
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);
  const hasAutoSubmitted = useRef(false);

  const callbackUrl = searchParams.get('callbackUrl') || '/rsvp';

  const hasUrlError =
    searchParams.get('error') === 'CredentialsSignin' ||
    searchParams.get('error') === 'Signin';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<InvitationCodeFormData>({
    resolver: zodResolver(invitationCodeSchema),
    defaultValues: {
      invitationCode: '',
    },
  });

  const onSubmit = async (data: InvitationCodeFormData) => {
    setAuthError('');
    setIsCodeNotRecognised(false);

    try {
      const result = await signIn('invitation-code', {
        invitationCode: data.invitationCode,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setAuthError(
          "That code wasn't recognised. Please check your invitation and try again.",
        );
        setIsCodeNotRecognised(true);
      } else if (result?.ok) {
        // @ts-expect-error - callbackUrl is a dynamic route from query params, not a literal type
        router.push(callbackUrl);
      }
    } catch {
      setAuthError('An error occurred during sign in. Please try again.');
    }
  };

  // Auto-submit when a pre-filled code is provided (QR deep-link flow).
  // Types each character of the code into the input before submitting,
  // giving users a clear visual cue that the code was auto-detected.
  useEffect(() => {
    if (!initialCode || hasAutoSubmitted.current) {
      return;
    }

    hasAutoSubmitted.current = true;
    const normalized = initialCode.trim().toLowerCase();
    const timers: ReturnType<typeof setTimeout>[] = [];

    const scheduleTimer = (fn: () => void, delay: number) => {
      const id = setTimeout(fn, delay);
      timers.push(id);

      return id;
    };

    // Type each character with a short delay between each keystroke.
    normalized.split('').forEach((_, index) => {
      scheduleTimer(
        () => {
          setValue('invitationCode', normalized.slice(0, index + 1));
        },
        300 + index * 80,
      );
    });

    // After typing completes, show the validating overlay then submit.
    const typingDuration = 300 + normalized.length * 80;

    scheduleTimer(() => {
      setIsAutoSubmitting(true);
    }, typingDuration + 200);

    scheduleTimer(() => {
      handleSubmit(onSubmit)();
    }, typingDuration + 900);

    return () => timers.forEach(clearTimeout);
  }, [initialCode]);

  const displayError =
    authError ||
    (hasUrlError
      ? "That code wasn't recognised. Please check your invitation and try again."
      : '');

  const showRecoveryLink = isCodeNotRecognised || hasUrlError;

  return (
    <div className="relative rounded-lg bg-[#fffdfb] p-8 shadow-xl">
      {isAutoSubmitting && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-[#fffdfb]/90 transition-opacity duration-700">
          <svg
            className="h-8 w-8 animate-spin text-[#9e3f3f]"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-sm font-medium text-[#9e3f3f]">
            Validating invitation code&hellip;
          </p>
        </div>
      )}

      <div
        className={`transition-opacity duration-700 ${isAutoSubmitting ? 'opacity-20' : 'opacity-100'}`}
      >
        <h2
          className={`${marcellusClassName} text-center text-4xl font-bold text-[#9e3f3f]`}
        >
          You&#39;re Invited
        </h2>
        <p className="text-center text-[#6a5555]">
          Enter your invitation code to continue
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        {displayError && (
          <div className="rounded-md border border-[#fcc] bg-[#fee] p-4 text-sm text-[#c33]">
            {displayError}
            {showRecoveryLink && (
              <>
                {' '}
                <Link
                  href="/rsvp/recover"
                  className="underline hover:opacity-80"
                >
                  Missing your code?
                </Link>
              </>
            )}
          </div>
        )}

        <div className="relative z-20">
          <label
            htmlFor="invitationCode"
            className="mb-2 block text-sm font-medium text-[#6a5555]"
          >
            Invitation Code
          </label>
          <input
            id="invitationCode"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck="false"
            {...register('invitationCode')}
            className="block w-full rounded-md border-0 bg-white px-4 py-3 text-[#6a5555] shadow-sm ring-1 ring-[#f3dedb] ring-inset placeholder:text-[#b5a0a0] focus:ring-2 focus:ring-[#9e3f3f] focus:ring-inset sm:text-sm sm:leading-6"
            placeholder="e.g. swift-panda"
            disabled={isSubmitting}
          />
          {errors.invitationCode && (
            <p className="mt-1 text-sm text-[#c33]">
              {errors.invitationCode.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9e3f3f]"
        >
          {isSubmitting ? 'Signing in...' : 'Continue to RSVP'}
        </Button>
        <p className="text-center text-sm text-[#6a5555]">
          <Link href="/rsvp/recover" className="underline hover:text-[#9e3f3f]">
            Missing or lost your invitation code?
          </Link>
        </p>
      </form>
    </div>
  );
}
