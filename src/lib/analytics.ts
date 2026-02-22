/**
 * Analytics event types for the wedding website.
 */
export type AnalyticsEventType =
  | 'page_view'
  | 'rsvp_submission'
  | 'navigate_to_rsvp';

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
 */
export function trackRsvpSubmission(): void {
  trackEvent({
    type: 'rsvp_submission',
    page: '/rsvp',
    timestamp: Date.now(),
  });
}

/**
 * Tracks navigation to the RSVP page.
 */
export function trackNavigateToRsvp(): void {
  trackEvent({
    type: 'navigate_to_rsvp',
    timestamp: Date.now(),
  });
}
