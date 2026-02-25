'use client';

/**
 * Client-side login form for guest authentication.
 *
 * Allows guests to sign in using their first and last name.
 * Uses Auth.js credentials provider for authentication.
 * Uses react-hook-form with Zod validation.
 * When multiple guests share the same name, presents an address disambiguation step.
 */
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/Button';
import { findDuplicateGuests, type DuplicateGuest } from '@/app/login/actions';

/**
 * Zod schema for login form validation.
 */
const loginSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .min(2, 'First name must be at least 2 characters')
    .trim(),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .min(2, 'Last name must be at least 2 characters')
    .trim(),
});

type LoginFormData = z.infer<typeof loginSchema>;

type LoginFormProps = {
  marcellusClassName: string;
};

export function LoginForm({ marcellusClassName }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authError, setAuthError] = useState('');
  const [duplicateGuests, setDuplicateGuests] = useState<
    DuplicateGuest[] | null
  >(null);
  const [pendingCredentials, setPendingCredentials] =
    useState<LoginFormData | null>(null);
  const [isSelectingGuest, setIsSelectingGuest] = useState(false);

  const callbackUrl = searchParams.get('callbackUrl') || '/schedule';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  /**
   * Performs the actual sign-in with optional guestId for disambiguation.
   */
  const performSignIn = async (
    firstName: string,
    lastName: string,
    guestId?: string,
  ) => {
    const result = await signIn('credentials', {
      firstName,
      lastName,
      ...(guestId && { guestId }),
      redirect: false,
      callbackUrl,
    });

    if (result?.error) {
      setAuthError('Guest not found. Please check your name and try again.');
      setDuplicateGuests(null);
      setPendingCredentials(null);
    } else if (result?.ok) {
      router.push(callbackUrl);
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    setAuthError('');

    try {
      const duplicates = await findDuplicateGuests(
        data.firstName,
        data.lastName,
      );

      if (duplicates) {
        setPendingCredentials(data);
        setDuplicateGuests(duplicates);

        return;
      }

      await performSignIn(data.firstName, data.lastName);
    } catch {
      setAuthError('An error occurred during sign in. Please try again.');
    }
  };

  /**
   * Handles selection of a specific guest when disambiguating duplicate names.
   */
  const onSelectGuest = async (guestId: string) => {
    if (!pendingCredentials) return;

    setIsSelectingGuest(true);
    setAuthError('');

    try {
      await performSignIn(
        pendingCredentials.firstName,
        pendingCredentials.lastName,
        guestId,
      );
    } catch {
      setAuthError('An error occurred during sign in. Please try again.');
    } finally {
      setIsSelectingGuest(false);
    }
  };

  const onCancelDisambiguation = () => {
    setDuplicateGuests(null);
    setPendingCredentials(null);
    setAuthError('');
  };

  // Show address disambiguation step when multiple guests share the same name
  if (duplicateGuests && pendingCredentials) {
    return (
      <div className="rounded-lg bg-[#fffdfb] p-8 shadow-xl">
        <div className="mb-8 space-y-2">
          <h2
            className={`${marcellusClassName} text-center text-4xl font-bold text-[#9e3f3f]`}
          >
            Select Your Invitation
          </h2>
          <p className="text-center text-[#6a5555]">
            We found multiple guests named{' '}
            <span className="font-medium">
              {pendingCredentials.firstName} {pendingCredentials.lastName}
            </span>
            . Please select the invitation address you received.
          </p>
        </div>

        {authError && (
          <div className="mb-4 rounded-md border border-[#fcc] bg-[#fee] p-4 text-sm text-[#c33]">
            {authError}
          </div>
        )}

        <div className="space-y-3">
          {duplicateGuests.map((guest) => (
            <button
              key={guest.guestId}
              onClick={() => onSelectGuest(guest.guestId)}
              disabled={isSelectingGuest}
              className="w-full rounded-md border border-[#f3dedb] bg-white px-4 py-4 text-left text-sm text-[#6a5555] shadow-sm transition-colors hover:border-[#9e3f3f] hover:bg-[#fff7f4] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {guest.address || 'No address on file'}
            </button>
          ))}
        </div>

        <button
          onClick={onCancelDisambiguation}
          disabled={isSelectingGuest}
          className="mt-4 w-full text-center text-sm text-[#9e3f3f] underline hover:no-underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-[#fffdfb] p-8 shadow-xl">
      <div className="mb-8 space-y-2">
        <h2
          className={`${marcellusClassName} text-center text-4xl font-bold text-[#9e3f3f]`}
        >
          Guest Sign In
        </h2>
        <p className="text-center text-[#6a5555]">
          Enter your name to view your personalized schedule
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        {authError && (
          <div className="rounded-md border border-[#fcc] bg-[#fee] p-4 text-sm text-[#c33]">
            {authError}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label
              htmlFor="firstName"
              className="mb-2 block text-sm font-medium text-[#6a5555]"
            >
              First Name
            </label>
            <input
              id="firstName"
              type="text"
              autoComplete="given-name"
              {...register('firstName')}
              className="block w-full rounded-md border-0 bg-white px-4 py-3 text-[#6a5555] shadow-sm ring-1 ring-[#f3dedb] ring-inset placeholder:text-[#b5a0a0] focus:ring-2 focus:ring-[#9e3f3f] focus:ring-inset sm:text-sm sm:leading-6"
              placeholder="Enter your first name"
              disabled={isSubmitting}
            />
            {errors.firstName && (
              <p className="mt-1 text-sm text-[#c33]">
                {errors.firstName.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="lastName"
              className="mb-2 block text-sm font-medium text-[#6a5555]"
            >
              Last Name
            </label>
            <input
              id="lastName"
              type="text"
              autoComplete="family-name"
              {...register('lastName')}
              className="block w-full rounded-md border-0 bg-white px-4 py-3 text-[#6a5555] shadow-sm ring-1 ring-[#f3dedb] ring-inset placeholder:text-[#b5a0a0] focus:ring-2 focus:ring-[#9e3f3f] focus:ring-inset sm:text-sm sm:leading-6"
              placeholder="Enter your last name"
              disabled={isSubmitting}
            />
            {errors.lastName && (
              <p className="mt-1 text-sm text-[#c33]">
                {errors.lastName.message}
              </p>
            )}
          </div>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9e3f3f]"
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
