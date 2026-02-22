'use client';

import Link from 'next/link';
import { trackNavigateToRsvp } from '@/lib/analytics';

/**
 * RSVP button that tracks when users navigate to the RSVP page.
 */
export function RsvpButton() {
  const handleClick = () => {
    trackNavigateToRsvp();
  };

  return (
    <Link
      href="/rsvp"
      onClick={handleClick}
      className="inline-block bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-semibold py-3 px-8 rounded-full shadow-lg transition-all duration-200"
    >
      RSVP Now
    </Link>
  );
}
