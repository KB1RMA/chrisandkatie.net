import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { auth, isGuestAuthenticated } from '@/lib/auth';

type RsvpLayoutProps = {
  children: ReactNode;
};

/**
 * Shared layout wrapper for all RSVP pages.
 *
 * Validates authentication on the server before rendering any RSVP content.
 * Redirects unauthenticated visitors to the login page.
 *
 * @param children - RSVP page content to render.
 */
export default async function RsvpLayout({ children }: RsvpLayoutProps) {
  const session = await auth();

  if (!isGuestAuthenticated(session)) {
    redirect('/login?callbackUrl=/rsvp');
  }

  return <>{children}</>;
}
