'use client';

/**
 * Header component with authentication status.
 *
 * Shows sign in button for unauthenticated users.
 * Shows user name and sign out button for authenticated users.
 */
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Great_Vibes } from 'next/font/google';

const greatVibes = Great_Vibes({
  subsets: ['latin'],
  weight: '400',
});

/**
 * Header component that displays authentication status and controls.
 *
 * @returns Header with navigation and auth controls
 */
export function Header() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const isHomepage = pathname === '/';

  return (
    <header className="sticky top-0 z-10 w-full border-b border-[#f3dedb] bg-white/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo/Brand */}
          {!isHomepage && (
            <Link
              href="/"
              className={`${greatVibes.className} text-3xl font-normal text-[#9e3f3f] transition-colors hover:text-[#b76565]`}
            >
              Katie & Chris
            </Link>
          )}
          {isHomepage && <div />}

          {/* Navigation Menu */}
          {session?.user && (
            <nav className="hidden items-center gap-6 sm:flex">
              <Link
                href="/schedule"
                className="text-sm font-medium text-[#6a5555] transition-colors hover:text-[#9e3f3f]"
              >
                Schedule
              </Link>
              <Link
                href="/rsvp"
                className="text-sm font-medium text-[#6a5555] transition-colors hover:text-[#9e3f3f]"
              >
                RSVP
              </Link>
              <Link
                href="/gallery"
                className="text-sm font-medium text-[#6a5555] transition-colors hover:text-[#9e3f3f]"
              >
                Gallery
              </Link>
            </nav>
          )}

          {/* Auth Controls */}
          <div className="flex items-center gap-4">
            {status === 'loading' ? (
              <div className="text-sm text-[#7a6666]">Loading...</div>
            ) : session?.user ? (
              <>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="rounded-md bg-[#9e3f3f] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#b76565] focus:ring-2 focus:ring-[#9e3f3f] focus:ring-offset-2 focus:outline-none"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-md bg-[#9e3f3f] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#b76565] focus:ring-2 focus:ring-[#9e3f3f] focus:ring-offset-2 focus:outline-none"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
