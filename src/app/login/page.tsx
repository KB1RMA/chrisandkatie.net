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
import { auth, getAuthIdentity } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
});

export default async function LoginPage(props: {
  searchParams: Promise<{ callbackUrl?: string; code?: string }>;
}) {
  // Resolve identity and redirect already-authenticated users
  const session = await auth();
  const identity = getAuthIdentity(session);
  const searchParams = await props.searchParams;

  if (identity?.type === 'admin') {
    const callbackUrl = searchParams.callbackUrl || '/admin/invitations';
    // @ts-expect-error - We don't have runtime type checking on the route. Accept the risk
    redirect(callbackUrl);
  }

  if (identity?.type === 'guest') {
    const callbackUrl = searchParams.callbackUrl || '/rsvp';
    // @ts-expect-error - We don't have runtime type checking on the route. Accept the risk
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
