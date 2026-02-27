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
      invitationCode: initialCode ?? '',
    },
  });

  const onSubmit = async (data: InvitationCodeFormData) => {
    setAuthError('');

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
      } else if (result?.ok) {
        // @ts-expect-error - callbackUrl is a dynamic route from query params, not a literal type
        router.push(callbackUrl);
      }
    } catch {
      setAuthError('An error occurred during sign in. Please try again.');
    }
  };

  // Auto-submit when a pre-filled code is provided (QR deep-link flow).
  useEffect(() => {
    if (!initialCode || hasAutoSubmitted.current) {
      return;
    }

    hasAutoSubmitted.current = true;
    setValue('invitationCode', initialCode.trim().toLowerCase());
    handleSubmit(onSubmit)();
  }, [initialCode]);

  const displayError =
    authError ||
    (hasUrlError
      ? "That code wasn't recognised. Please check your invitation and try again."
      : '');

  return (
    <div className="rounded-lg bg-[#fffdfb] p-8 shadow-xl">
      <div className="mb-8 space-y-2">
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
          </div>
        )}

        <div>
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
      </form>
    </div>
  );
}
