import type { Session } from 'next-auth';

/**
 * Discriminated union representing the resolved identity of the current user.
 *
 * - `admin` — authenticated administrator (from admin-credentials provider)
 * - `guest` — authenticated wedding guest (from invitation-code provider)
 */
export type AuthIdentity =
  { type: 'admin'; username: string } | { type: 'guest'; invitationId: string };

/**
 * Resolves the caller's identity from a session.
 *
 * This module is client-safe: it imports only types from next-auth and
 * contains no server-only dependencies. Import from here in client components.
 *
 * @param session - The session object returned by `auth()` or `useSession()`, or null.
 * @returns The resolved identity, or null if the user is unauthenticated.
 */
export function getAuthIdentity(session: Session | null): AuthIdentity | null {
  if (!session?.user) {
    return null;
  }

  if (session.user.roles?.includes('admin') && session.user.username) {
    return { type: 'admin', username: session.user.username };
  }

  if (session.user.invitationId) {
    return { type: 'guest', invitationId: session.user.invitationId };
  }

  return null;
}
