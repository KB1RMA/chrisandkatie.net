/**
 * Login page for guest authentication.
 *
 * Server Component that renders the invitation code login form by default.
 * An unobtrusive "Admin sign in" toggle reveals the admin credentials form.
 * Supports QR code deep-link auto-submission via the `?code=` query parameter.
 */
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { LoginPageContent } from '@/components/LoginPageContent';
import { Marcellus } from 'next/font/google';

export const metadata: Metadata = {
  title: 'Login',
  description: 'Login to access your wedding celebration details',
};
import { auth, isGuestAuthenticated } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
});

export default async function LoginPage(props: {
  searchParams: Promise<{ callbackUrl?: string; code?: string }>;
}) {
  // Check if user is already authenticated
  const session = await auth();
  const searchParams = await props.searchParams;

  if (isGuestAuthenticated(session)) {
    // User is already logged in — redirect to RSVP or callback URL
    const callbackUrl = searchParams.callbackUrl || '/rsvp';
    // @ts-expect-error - callbackUrl is a dynamic route from query params, not a literal type
    redirect(callbackUrl);
  }

  return (
    <div className="font-roboto flex min-h-screen items-center justify-start bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] px-4 py-12 sm:justify-center sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <Suspense>
          <LoginPageContent
            marcellusClassName={marcellus.className}
            initialCode={searchParams.code}
          />
        </Suspense>
      </div>
    </div>
  );
}

