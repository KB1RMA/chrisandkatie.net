import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { auth, getAuthIdentity } from '@/lib/auth';

type RsvpLayoutProps = {
  children: ReactNode;
};

/**
 * Shared layout wrapper for all RSVP pages.
 *
 * Validates authentication on the server before rendering any RSVP content.
 * Unauthenticated visitors are redirected to the login page. Admin users see
 * an informational message since they don't have a guest invitation.
 *
 * @param children - RSVP page content to render.
 */
export default async function RsvpLayout({ children }: RsvpLayoutProps) {
  const session = await auth();
  const identity = getAuthIdentity(session);

  if (!identity) {
    redirect('/login?callbackUrl=/rsvp');
  }

  if (identity.type === 'admin') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-8">
        <div className="w-full max-w-md rounded-lg bg-[#fffdfb] p-8 text-center shadow-lg">
          <h1 className="mb-3 text-2xl font-semibold text-[#9e3f3f]">
            No Invitation Found
          </h1>
          <p className="mb-6 text-[#6a5555]">
            Admin accounts don&apos;t have a guest invitation. To manage RSVPs,
            visit the admin dashboard.
          </p>
          <Link
            href="/admin/events"
            className="inline-block rounded bg-[#9e3f3f] px-5 py-2 text-sm font-medium text-white hover:bg-[#7d3232]"
          >
            Go to Admin Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
