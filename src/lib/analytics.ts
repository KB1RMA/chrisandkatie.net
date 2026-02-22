/**
 * Analytics event types for the wedding website.
 */
export type AnalyticsEventType =
  | 'page_view'
  | 'rsvp_submission'
  | 'navigate_to_page';

/**
 * Analytics event structure.
 */
export type AnalyticsEvent = {
  type: AnalyticsEventType;
  page?: string;
  referrer?: string;
  timestamp: number;
};

/**
 * Sends an analytics event to the tracking endpoint using Beacon API.
 * Beacon API is ideal for analytics - non-blocking and survives page unloads.
 *
 * @param event - The analytics event to track.
 * @returns Nothing.
 * @throws {Error} Does not throw.
 */
export function trackEvent(event: AnalyticsEvent): void {
  // Check if Beacon API is available (client-side only)
  if (typeof navigator === 'undefined' || !navigator.sendBeacon) {
    return;
  }

  try {
    const blob = new Blob([JSON.stringify(event)], {
      type: 'application/json',
    });
    navigator.sendBeacon('/api/analytics', blob);
  } catch {
    // Silently fail - analytics shouldn't impact user experience
  }
}

/**
 * Tracks a page view event.
 *
 * @param page - The page path (e.g., "/", "/rsvp").
 * @param referrer - Optional referrer source.
 * @returns Nothing.
 * @throws {Error} Does not throw.
 */
export function trackPageView(page: string, referrer?: string): void {
  trackEvent({
    type: 'page_view',
    page,
    referrer,
    timestamp: Date.now(),
  });
}

/**
 * Tracks an RSVP form submission.
 *
 * @returns Nothing.
 * @throws {Error} Does not throw.
 */
export function trackRsvpSubmission(): void {
  trackEvent({
    type: 'rsvp_submission',
    page: '/rsvp',
    timestamp: Date.now(),
  });
}

/**
 * Tracks navigation to a page by its href.
 *
 * @param href - The path being navigated to.
 * @returns Nothing.
 * @throws {Error} Does not throw.
 */
export function trackNavigateToPath(href: string): void {
  trackEvent({
    type: 'navigate_to_page',
    page: href,
    timestamp: Date.now(),
  });
}
