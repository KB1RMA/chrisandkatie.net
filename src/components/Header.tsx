'use client';

/**
 * Header component with authentication status.
 *
 * Shows sign in button for unauthenticated users.
 * Shows user name and sign out button for authenticated users.
 */
import { useState, useEffect } from 'react';
import type { Route } from 'next';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Great_Vibes } from 'next/font/google';
import { getAuthIdentity } from '@/lib/auth-identity';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close the mobile menu on any route change (logo link, back button, etc.)
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const identity = getAuthIdentity(session ?? null);
  const isAdmin = identity?.type === 'admin';

  const navLinks: { href: Route; label: string }[] = [
    { href: '/schedule', label: 'Schedule' },
    { href: '/rsvp', label: 'RSVP' },
    { href: '/gallery', label: 'Gallery' },
    { href: '/lodging', label: 'Hotels & FAQ' },
  ];

  const adminLinks: { href: Route; label: string }[] = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/invitations', label: 'Invitations' },
    { href: '/admin/events', label: 'Events' },
    { href: '/admin/guests', label: 'Guests' },
    { href: '/admin/rsvp', label: 'RSVPs' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#f3dedb] bg-white/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
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

          {/* Desktop Navigation Menu */}
          {session?.user && (
            <nav className="hidden items-center gap-6 sm:flex">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-[#6a5555] transition-colors hover:text-[#9e3f3f]"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}

          {/* Auth Controls + Mobile Hamburger */}
          <div className="flex items-center gap-4">
            {status === 'loading' ? (
              <div className="text-sm text-[#7a6666]">Loading...</div>
            ) : session?.user ? (
              <>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="hidden rounded-md bg-[#9e3f3f] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#b76565] focus:ring-2 focus:ring-[#9e3f3f] focus:ring-offset-2 focus:outline-none sm:block"
                >
                  Sign Out
                </button>

                {/* Mobile hamburger button */}
                <button
                  onClick={() => setMobileMenuOpen((open) => !open)}
                  aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                  aria-expanded={mobileMenuOpen}
                  className="flex h-9 w-9 flex-col items-center justify-center gap-1.5 rounded-md text-[#9e3f3f] transition-colors hover:bg-[#f3dedb] focus:outline-none sm:hidden"
                >
                  <span
                    className={`block h-0.5 w-5 bg-current transition-transform duration-200 ${mobileMenuOpen ? 'translate-y-2 rotate-45' : ''}`}
                  />
                  <span
                    className={`block h-0.5 w-5 bg-current transition-opacity duration-200 ${mobileMenuOpen ? 'opacity-0' : ''}`}
                  />
                  <span
                    className={`block h-0.5 w-5 bg-current transition-transform duration-200 ${mobileMenuOpen ? '-translate-y-2 -rotate-45' : ''}`}
                  />
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

      {/* Mobile Navigation Drawer — always rendered, animated via grid-row expansion */}
      {session?.user && (
        <div
          className={`grid transition-all duration-300 ease-in-out sm:hidden ${
            mobileMenuOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="overflow-hidden">
            <div
              className={`border-t border-[#f3dedb] bg-white/95 backdrop-blur-sm transition-opacity duration-300 ${
                mobileMenuOpen ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <nav className="mx-auto max-w-7xl px-4 py-3">
                <ul className="flex flex-col">
                  {navLinks.map((link, index) => (
                    <li
                      key={link.href}
                      className={`transition-all duration-200 ${
                        mobileMenuOpen
                          ? 'translate-y-0 opacity-100'
                          : '-translate-y-1 opacity-0'
                      }`}
                      style={{
                        transitionDelay: mobileMenuOpen
                          ? `${index * 40 + 60}ms`
                          : '0ms',
                      }}
                    >
                      <Link
                        href={link.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`block px-2 py-3 text-base font-medium transition-colors ${
                          pathname === link.href
                            ? 'text-[#9e3f3f]'
                            : 'text-[#6a5555] hover:text-[#9e3f3f]'
                        }`}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                  {isAdmin && (
                    <>
                      <li
                        className={`mt-1 border-t border-[#f3dedb] pt-2 transition-all duration-200 ${
                          mobileMenuOpen
                            ? 'translate-y-0 opacity-100'
                            : '-translate-y-1 opacity-0'
                        }`}
                        style={{
                          transitionDelay: mobileMenuOpen
                            ? `${navLinks.length * 40 + 60}ms`
                            : '0ms',
                        }}
                      >
                        <p className="px-2 pt-2 pb-1 text-xs font-semibold tracking-widest text-[#9e3f3f]/60 uppercase">
                          Admin
                        </p>
                      </li>
                      {adminLinks.map((link, index) => (
                        <li
                          key={link.href}
                          className={`transition-all duration-200 ${
                            mobileMenuOpen
                              ? 'translate-y-0 opacity-100'
                              : '-translate-y-1 opacity-0'
                          }`}
                          style={{
                            transitionDelay: mobileMenuOpen
                              ? `${(navLinks.length + index + 1) * 40 + 60}ms`
                              : '0ms',
                          }}
                        >
                          <Link
                            href={link.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`block px-2 py-3 text-base font-medium transition-colors ${
                              pathname === link.href
                                ? 'text-[#9e3f3f]'
                                : 'text-[#6a5555] hover:text-[#9e3f3f]'
                            }`}
                          >
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </>
                  )}
                  <li
                    className={`mt-1 border-t border-[#f3dedb] pt-3 transition-all duration-200 ${
                      mobileMenuOpen
                        ? 'translate-y-0 opacity-100'
                        : '-translate-y-1 opacity-0'
                    }`}
                    style={{
                      transitionDelay: mobileMenuOpen
                        ? `${(navLinks.length + (isAdmin ? adminLinks.length + 1 : 0)) * 40 + 60}ms`
                        : '0ms',
                    }}
                  >
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        signOut({ callbackUrl: '/' });
                      }}
                      className="w-full rounded-md bg-[#9e3f3f] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#b76565] focus:ring-2 focus:ring-[#9e3f3f] focus:ring-offset-2 focus:outline-none"
                    >
                      Sign Out
                    </button>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
