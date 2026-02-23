'use client';

/**
 * Client-side login form for guest authentication.
 *
 * Allows guests to sign in using their first and last name.
 * Uses Auth.js credentials provider for authentication.
 * Uses react-hook-form with Zod validation.
 */
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/Button';

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

  const callbackUrl = searchParams.get('callbackUrl') || '/schedule';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setAuthError('');

    try {
      const result = await signIn('credentials', {
        firstName: data.firstName,
        lastName: data.lastName,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setAuthError('Guest not found. Please check your name and try again.');
      } else if (result?.ok) {
        // @ts-expect-error - router.push() has defined types and we know callbackUrl is a string,
        // but TypeScript can't infer the actual route here
        router.push(callbackUrl);
      }
    } catch {
      setAuthError('An error occurred during sign in. Please try again.');
    }
  };

  return (
    <div className="bg-[#fffdfb] rounded-lg shadow-xl p-8">
      <div className="space-y-2 mb-8">
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
          <div className="rounded-md bg-[#fee] border border-[#fcc] p-4 text-sm text-[#c33]">
            {authError}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label
              htmlFor="firstName"
              className="block text-sm font-medium text-[#6a5555] mb-2"
            >
              First Name
            </label>
            <input
              id="firstName"
              type="text"
              autoComplete="given-name"
              {...register('firstName')}
              className="block w-full rounded-md border-0 px-4 py-3 text-[#6a5555] bg-white shadow-sm ring-1 ring-inset ring-[#f3dedb] placeholder:text-[#b5a0a0] focus:ring-2 focus:ring-inset focus:ring-[#9e3f3f] sm:text-sm sm:leading-6"
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
              className="block text-sm font-medium text-[#6a5555] mb-2"
            >
              Last Name
            </label>
            <input
              id="lastName"
              type="text"
              autoComplete="family-name"
              {...register('lastName')}
              className="block w-full rounded-md border-0 px-4 py-3 text-[#6a5555] bg-white shadow-sm ring-1 ring-inset ring-[#f3dedb] placeholder:text-[#b5a0a0] focus:ring-2 focus:ring-inset focus:ring-[#9e3f3f] sm:text-sm sm:leading-6"
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
