/**
 * @vitest-environment node
 */
import { SignJWT } from 'jose';

import { auth, getAuthIdentity } from '@/lib/auth';

/** Lifetime of the WebSocket connection token in seconds. */
const TOKEN_TTL_SECONDS = 30;

/**
 * GET /api/photo-booth/ws-token
 *
 * Issues a short-lived signed JWT for authenticating a PartyKit WebSocket
 * connection. The client passes this token as a `?token=` query parameter
 * when opening the socket; PartyKit verifies it using the same `AUTH_SECRET`
 * before allowing the connection.
 *
 * Using a separate, short-lived token keeps the full NextAuth session JWT out
 * of WebSocket connection URLs (which appear in server logs).
 *
 * @returns 200 JSON `{ token: string }` on success; 401 if unauthenticated; 500 if `AUTH_SECRET` is not configured.
 */
export async function GET(): Promise<Response> {
  const session = await auth();
  const identity = getAuthIdentity(session);

  if (!identity) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    return Response.json(
      { error: 'AUTH_SECRET is not configured' },
      { status: 500 },
    );
  }

  // Encode the secret as a Uint8Array for use with the symmetric HS256 algorithm.
  const keyBytes = new TextEncoder().encode(secret);

  // Extract a stable subject identifier from the identity.
  const subject =
    identity.type === 'admin' ? identity.username : identity.invitationId;

  // Build a minimal JWT scoped to PartyKit WebSocket connections only.
  const token = await new SignJWT({ sub: subject })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience('partykit-ws')
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(keyBytes);

  return Response.json({ token });
}
