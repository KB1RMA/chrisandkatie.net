import { type Session } from 'next-auth';

/**
 * Creates a minimal session fixture for use in tests.
 *
 * Auth identity is determined by `getAuthIdentity` which should be mocked
 * separately — session fields do not need to reflect the identity type.
 *
 * @param user - Optional user fields to include on the session.
 * @returns A Session object with a future expiry.
 */
export function makeSession(user: Partial<Session['user']> = {}): Session {
  return {
    user,
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}
