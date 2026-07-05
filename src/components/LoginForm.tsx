'use client';

/**
 * Client-side admin login form.
 *
 * Allows administrators to sign in using a username and password.
 * Uses Auth.js admin-credentials provider for authentication.
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
 * Zod schema for admin login form validation.
 */
const loginSchema = z.object({
  username: z.string().min(1, 'Username is required').trim(),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

type LoginFormProps = {
  marcellusClassName: string;
};

export function LoginForm({ marcellusClassName }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authError, setAuthError] = useState('');

  const callbackUrl = searchParams.get('callbackUrl') || '/admin/events';

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
      const result = await signIn('admin-credentials', {
        username: data.username,
        password: data.password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setAuthError(
          'Invalid credentials. Please check your username and password.',
        );
      } else if (result?.ok) {
        // @ts-expect-error - callbackUrl is a dynamic route from query params, not a literal type
        router.push(callbackUrl);
      }
    } catch {
      setAuthError('An error occurred during sign in. Please try again.');
    }
  };

  return (
    <div className="rounded-lg bg-[#fffdfb] p-8 shadow-xl">
      <div className="mb-8 space-y-2">
        <h2
          className={`${marcellusClassName} text-center text-4xl font-bold text-[#9e3f3f]`}
        >
          Admin Sign In
        </h2>
        <p className="text-center text-[#6a5555]">
          Enter your admin credentials to continue
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
              htmlFor="username"
              className="mb-2 block text-sm font-medium text-[#6a5555]"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              {...register('username')}
              className="block w-full rounded-md border-0 bg-white px-4 py-3 text-[#6a5555] shadow-sm ring-1 ring-[#f3dedb] ring-inset placeholder:text-[#b5a0a0] focus:ring-2 focus:ring-[#9e3f3f] focus:ring-inset sm:text-sm sm:leading-6"
              placeholder="Enter your username"
              disabled={isSubmitting}
            />
            {errors.username && (
              <p className="mt-1 text-sm text-[#c33]">
                {errors.username.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-[#6a5555]"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
              className="block w-full rounded-md border-0 bg-white px-4 py-3 text-[#6a5555] shadow-sm ring-1 ring-[#f3dedb] ring-inset placeholder:text-[#b5a0a0] focus:ring-2 focus:ring-[#9e3f3f] focus:ring-inset sm:text-sm sm:leading-6"
              placeholder="Enter your password"
              disabled={isSubmitting}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-[#c33]">
                {errors.password.message}
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
