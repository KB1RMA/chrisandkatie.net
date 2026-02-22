import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { AnalyticsEvent } from '@/lib/analytics';

// In-memory event log (stores last 1000 events)
const eventLog: AnalyticsEvent[] = [];
const MAX_EVENTS = 1000;

/**
 * Analytics Engine binding type.
 */
type CloudflareEnv = {
  ANALYTICS?: {
    writeDataPoint: (data: {
      indexes: string[];
      blobs: string[];
      doubles: number[];
    }) => void;
  };
  ANALYTICS_ENABLED?: string;
};

/**
 * Logs analytics events to Cloudflare Analytics Engine and stores locally.
 * Returns a simple 200 response for all requests.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const event: AnalyticsEvent = await request.json();

    // Add to in-memory log
    eventLog.push(event);

    // Keep log size manageable
    if (eventLog.length > MAX_EVENTS) {
      eventLog.shift();
    }

    // Write to Cloudflare Analytics Engine if enabled
    const env = (request as NextRequest & { env: CloudflareEnv }).env;
    const analyticsEnabled = env?.ANALYTICS_ENABLED === 'true';
    const analytics = env?.ANALYTICS;

    if (analyticsEnabled && analytics) {
      try {
        analytics.writeDataPoint({
          indexes: [event.type, event.page ?? 'unknown'],
          blobs: [event.referrer ?? 'direct'],
          doubles: [Date.now()],
        });
      } catch {
        // Silently fail - analytics shouldn't impact user experience
      }
    }

    // Log to console for Cloudflare Workers to capture
    console.log('[Analytics]', JSON.stringify(event));

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    // Silently fail - don't expose errors to client
    return NextResponse.json({ success: false }, { status: 200 });
  }
}

/**
 * GET endpoint to retrieve analytics summary.
 * Access via /_analytics/summary (protected in production).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const env = (request as NextRequest & { env: CloudflareEnv }).env;
  const analyticsEnabled = env?.ANALYTICS_ENABLED === 'true';

  const summary = {
    analyticsEnabled,
    totalEvents: eventLog.length,
    pageViews: eventLog.filter((e) => e.type === 'page_view').length,
    rsvpSubmissions: eventLog.filter((e) => e.type === 'rsvp_submission')
      .length,
    navigateToPage: eventLog.filter((e) => e.type === 'navigate_to_page')
      .length,
    lastEvents: eventLog.slice(-10),
  };

  return NextResponse.json(summary);
}
