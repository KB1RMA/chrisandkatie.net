/**
 * Next.js Edge Middleware for rate limiting authentication attempts.
 *
 * Protects the sign-in endpoint against brute-force attacks by tracking
 * POST requests per IP within a rolling time window.
 *
 * NOTE: This in-memory store persists only within a single Cloudflare
 * Worker V8 isolate lifetime. For guaranteed per-IP rate limiting across
 * all edge instances, use Cloudflare WAF Rate Limiting rules in the
 * Cloudflare dashboard instead of (or in addition to) this middleware.
 */
import { type NextRequest, NextResponse } from 'next/server';

/** Maximum sign-in attempts allowed within the rate limit window. */
const MAX_ATTEMPTS = 10;

/** Rolling window duration in milliseconds (5 minutes). */
const WINDOW_MS = 5 * 60 * 1000;

type RateLimitEntry = {
  count: number;
  windowStart: number;
};

// Module-level store — persists within a single worker isolate instance.
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Extract the best-available client IP from request headers.
 *
 * @param request - Incoming Next.js request.
 * @returns IP address string, or 'unknown' if not determinable.
 */
function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

/**
 * Check whether the given IP has exceeded the rate limit and record
 * the current attempt.
 *
 * @param ip - Client IP address.
 * @returns True if the request should be blocked, false otherwise.
 */
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });

    return false;
  }

  entry.count += 1;

  return entry.count > MAX_ATTEMPTS;
}

/**
 * Middleware — runs on the Cloudflare Workers edge before each matched route.
 *
 * @param request - Incoming Next.js edge request.
 * @returns 429 response if rate limited, otherwise passes the request through.
 */
export function middleware(request: NextRequest): NextResponse {
  const ip = getClientIp(request);

  if (isRateLimited(ip)) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': '300',
        'Content-Type': 'text/plain',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  // Only apply rate limiting to the sign-in route POST handler.
  matcher: '/api/auth/signin',
};
