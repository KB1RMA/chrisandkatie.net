'use client';

/**
 * Header component with authentication status.
 *
 * Shows sign in button for unauthenticated users.
 * Shows user name and sign out button for authenticated users.
 */
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

/**
 * Header component that displays authentication status and controls.
 *
 * @returns Header with navigation and auth controls
 */
export function Header() {
  const { data: session, status } = useSession();

  return (
    <header className="w-full bg-white/80 backdrop-blur-sm border-b border-[#f3dedb] sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <Link
            href="/"
            className="text-xl font-semibold text-[#9e3f3f] hover:text-[#b76565] transition-colors"
          >
            Chris & Katie
          </Link>

          {/* Auth Controls */}
          <div className="flex items-center gap-4">
            {status === 'loading' ? (
              <div className="text-sm text-[#7a6666]">Loading...</div>
            ) : session?.user ? (
              <>
                <span className="text-sm text-[#6a5555]">
                  Hello, {session.user.name?.split(' ')[0]}!
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#9e3f3f] rounded-md hover:bg-[#b76565] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#9e3f3f]"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium text-white bg-[#9e3f3f] rounded-md hover:bg-[#b76565] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#9e3f3f]"
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
