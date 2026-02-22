'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackPageView } from '@/lib/analytics';

/**
 * Client-side page view tracker.
 * Tracks page views on both initial load and router navigation.
 */
export function PageViewTracker(): null {
  const pathname = usePathname();

  useEffect(() => {
    // Track page view whenever pathname changes (includes initial load)
    const referrer = document.referrer || undefined;
    trackPageView(pathname, referrer);
  }, [pathname]);

  return null;
}
