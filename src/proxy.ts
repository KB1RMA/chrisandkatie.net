import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Proxy handler to track page views and basic analytics.
 * Runs on every request to track which pages are being visited.
 */
export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip tracking for API routes, static assets, and system paths
  const skipPaths = ['/api/', '/_next/', '/favicon', '/public/'];

  if (skipPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Track the page view asynchronously
  // The analytics event will be sent to our API route
  // Note: This happens server-side for initial page load
  const referrer = request.headers.get('referer') ?? undefined;

  // Create a response that will trigger analytics tracking
  const response = NextResponse.next();

  // Add headers that the layout can use for tracking
  response.headers.set('x-pathname', pathname);
  response.headers.set('x-referrer', referrer ?? '');

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - robots.txt (robots file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt).*)',
  ],
};
