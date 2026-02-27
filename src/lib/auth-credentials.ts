/**
 * Administrator credential authorization logic.
 *
 * Kept separate from auth.ts to allow unit testing without importing the
 * full NextAuth stack (which depends on next/server at runtime).
 */

/**
 * Handles administrator credential authorization.
 *
 * Accepts username and password credentials and validates them against the
 * ADMIN_USERNAME and ADMIN_PASSWORD environment variables.
 * Returns null for any non-admin or missing credential submission.
 *
 * @param credentials - The submitted username and password credentials.
 * @returns Authorized admin user object, or null if unauthorized.
 */
export async function authorizeCredentials(
  credentials: Partial<Record<'username' | 'password', unknown>>,
) {
  if (!credentials?.username || !credentials?.password) {
    return null;
  }

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    return null;
  }

  if (
    credentials.username !== adminUsername ||
    credentials.password !== adminPassword
  ) {
    return null;
  }

  return {
    id: 'admin',
    name: 'Admin',
    email: null,
    username: adminUsername,
    roles: ['admin'],
  };
}
