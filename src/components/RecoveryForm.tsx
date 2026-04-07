'use client';

/**
 * Client component for the invitation code recovery form.
 *
 * Handles form state, validation, and the server action call. Renders either
 * the recovery form or the code-reveal panel depending on the action result.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { recoverSchema } from '@/lib/schemas/recover';
import type { RecoverInput } from '@/lib/schemas/recover';
import { recoverInvitationCode } from '@/app/rsvp/recover/actions';
import type { RecoverInvitationCodeResult } from '@/app/rsvp/recover/actions';
import { Button } from '@/components/Button';

export function RecoveryForm() {
  const [result, setResult] = useState<RecoverInvitationCodeResult | null>(
    null,
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecoverInput>({
    resolver: zodResolver(recoverSchema),
  });

  const onSubmit = async (data: RecoverInput) => {
    const response = await recoverInvitationCode(data);
    setResult(response);
  };

  if (result?.success) {
    return (
      <div className="rounded-lg bg-[#fffdfb] p-8 shadow-xl">
        <h1 className="mb-4 text-center text-2xl font-bold text-[#9e3f3f]">
          Your Invitation Code
        </h1>
        <p className="mb-6 text-center text-[#6a5555]">
          We found your invitation. Here is your code:
        </p>
        <div className="mb-6 rounded-md border border-[#f3dedb] bg-[#fff7f4] px-6 py-4 text-center font-mono text-2xl font-semibold tracking-wide text-[#9e3f3f]">
          {result.invitationCode}
        </div>
        <Link
          href={`/login?code=${encodeURIComponent(result.invitationCode)}`}
          className="block w-full rounded-md bg-[#9e3f3f] px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-[#8a3535] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9e3f3f]"
        >
          Sign in with this code
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-[#fffdfb] p-8 shadow-xl">
      <h1 className="mb-2 text-center text-2xl font-bold text-[#9e3f3f]">
        Find Your Invitation Code
      </h1>
      <p className="mb-6 text-center text-sm text-[#6a5555]">
        Enter the last name, street address, and ZIP code your invitation was
        mailed to.
      </p>

      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        {result && !result.success && (
          <div className="rounded-md border border-[#fcc] bg-[#fee] p-4 text-sm text-[#c33]">
            {result.error}
          </div>
        )}

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
            placeholder="e.g. Smith"
            disabled={isSubmitting}
          />
          {errors.lastName && (
            <p className="mt-1 text-sm text-[#c33]">
              {errors.lastName.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="streetAddress"
            className="mb-2 block text-sm font-medium text-[#6a5555]"
          >
            Street Address
          </label>
          <input
            id="streetAddress"
            type="text"
            autoComplete="street-address"
            {...register('streetAddress')}
            className="block w-full rounded-md border-0 bg-white px-4 py-3 text-[#6a5555] shadow-sm ring-1 ring-[#f3dedb] ring-inset placeholder:text-[#b5a0a0] focus:ring-2 focus:ring-[#9e3f3f] focus:ring-inset sm:text-sm sm:leading-6"
            placeholder="e.g. 123 Main St"
            disabled={isSubmitting}
          />
          {errors.streetAddress && (
            <p className="mt-1 text-sm text-[#c33]">
              {errors.streetAddress.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="zipCode"
            className="mb-2 block text-sm font-medium text-[#6a5555]"
          >
            ZIP Code
          </label>
          <input
            id="zipCode"
            type="text"
            autoComplete="postal-code"
            inputMode="numeric"
            {...register('zipCode')}
            className="block w-full rounded-md border-0 bg-white px-4 py-3 text-[#6a5555] shadow-sm ring-1 ring-[#f3dedb] ring-inset placeholder:text-[#b5a0a0] focus:ring-2 focus:ring-[#9e3f3f] focus:ring-inset sm:text-sm sm:leading-6"
            placeholder="e.g. 62701"
            disabled={isSubmitting}
          />
          {errors.zipCode && (
            <p className="mt-1 text-sm text-[#c33]">{errors.zipCode.message}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9e3f3f]"
        >
          {isSubmitting ? 'Searching...' : 'Find My Code'}
        </Button>
      </form>
    </div>
  );
}
