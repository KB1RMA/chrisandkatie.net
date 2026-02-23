/**
 * Login page for guest authentication.
 *
 * Server Component that renders the login form.
 * Redirects to schedule page after successful authentication.
 */
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/LoginForm';
import { Marcellus } from 'next/font/google';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
});

export default async function LoginPage(props: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  // Check if user is already authenticated
  const session = await auth();
  const searchParams = await props.searchParams;

  if (session?.user?.guestId) {
    // User is already logged in, redirect to callback or default page
    const callbackUrl = searchParams.callbackUrl || '/schedule';
    // @ts-expect-error - We can't validate that this is a valid route
    redirect(callbackUrl);
  }

  return (
    <div className="font-roboto flex min-h-screen items-center justify-start sm:justify-center bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <Suspense>
          <LoginForm marcellusClassName={marcellus.className} />
        </Suspense>
      </div>
    </div>
  );
}
