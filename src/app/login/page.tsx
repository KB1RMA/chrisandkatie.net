/**
 * Login page for guest authentication.
 *
 * Server Component that renders the login form.
 * Redirects to schedule page after successful authentication.
 */
import { Suspense } from 'react';
import { LoginForm } from '@/components/LoginForm';
import { Marcellus } from 'next/font/google';

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
});

export default function LoginPage() {
  return (
    <div className="font-roboto flex min-h-screen items-center justify-center bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <Suspense>
          <LoginForm marcellusClassName={marcellus.className} />
        </Suspense>
      </div>
    </div>
  );
}
