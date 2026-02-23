/**
 * Auth.js v5 API route handler.
 *
 * Handles all authentication endpoints: /api/auth/signin, /api/auth/signout, etc.
 * Uses Cloudflare environment bindings when deployed as a Worker.
 */
import { createAuth } from '@/lib/auth';
import type { NextRequest } from 'next/server';

/**
 * Handles GET requests to Auth.js endpoints.
 * Creates auth instance with Cloudflare D1 binding if available.
 */
export async function GET(req: NextRequest) {
  const env = (req as typeof req & { env?: CloudflareEnv }).env;
  const { handlers } = createAuth(env);

  return handlers.GET(req);
}

/**
 * Handles POST requests to Auth.js endpoints.
 * Creates auth instance with Cloudflare D1 binding if available.
 */
export async function POST(req: NextRequest) {
  const env = (req as typeof req & { env?: CloudflareEnv }).env;
  const { handlers } = createAuth(env);

  return handlers.POST(req);
}
