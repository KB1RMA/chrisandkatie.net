/**
 * Auth.js v5 configuration for guest and admin authentication.
 *
 * Uses two custom credentials providers:
 * - `admin-credentials`: Validates admin username/password against env vars.
 * - `invitation-code`: Authenticates guests by two-word invitation code.
 *
 * Sessions are handled via JWT — no database adapter is used because both
 * authorize functions manage user records manually and there are no OAuth
 * providers requiring account linking.
 */
import NextAuth, { type DefaultSession, type Session } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { getDb } from '@/lib/db';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export { authorizeCredentials } from '@/lib/auth-credentials';
import { authorizeCredentials } from '@/lib/auth-credentials';
import { authorizeInvitationCode } from '@/lib/auth-invitation-code';

/**
 * Discriminated union representing the resolved identity of the current user.
 *
 * - `admin` — authenticated administrator (from admin-credentials provider)
 * - `guest` — authenticated wedding guest (from invitation-code provider)
 */
export type AuthIdentity =
  | { type: 'admin'; username: string }
  | { type: 'guest'; invitationId: string };

/**
 * Extends the default session to include username, invitationId, and roles.
 */
declare module 'next-auth' {
  interface Session {
    user: {
      username?: string;
      roles?: string[];
      invitationId?: string;
    } & DefaultSession['user'];
  }

  interface User {
    username?: string;
    roles?: string[];
    invitationId?: string;
  }
}

/**
 * Creates Next Auth v5 configuration.
 *
 * @param env - Optional Cloudflare environment bindings (for D1)
 * @returns NextAuth instance with auth(), signIn(), signOut() handlers
 */
export function createAuth(env?: CloudflareEnv) {
  // In Cloudflare Workers, env vars are in the env binding, not process.env
  // NextAuth reads from process.env internally, so we need to set them explicitly
  if (env?.AUTH_SECRET) {
    process.env.AUTH_SECRET = env.AUTH_SECRET;
  }

  // AUTH_URL is the canonical env var for Auth.js v5; NEXTAUTH_URL is the v4
  // legacy fallback. Sync both so the correct base URL is used regardless of
  // which version of the internal lookup runs first.
  const authUrl = env?.AUTH_URL ?? env?.NEXTAUTH_URL;

  if (authUrl) {
    process.env.AUTH_URL = authUrl;
    process.env.NEXTAUTH_URL = authUrl;
  }

  return NextAuth({
    trustHost: true, // Required for Cloudflare Workers with custom domains

    providers: [
      Credentials({
        id: 'admin-credentials',
        name: 'Admin Login',
        credentials: {
          username: { label: 'Username', type: 'text' },
          password: { label: 'Password', type: 'password' },
        },

        /**
         * Authenticates an administrator via env-var credential check.
         */
        async authorize(credentials) {
          return authorizeCredentials(credentials);
        },
      }),

      Credentials({
        id: 'invitation-code',
        name: 'Invitation Code',
        credentials: {
          invitationCode: { label: 'Invitation Code', type: 'text' },
        },

        /**
         * Authenticates a guest via two-word invitation code.
         */
        async authorize(credentials) {
          const db = getDb();

          return authorizeInvitationCode(credentials, db);
        },
      }),
    ],

    callbacks: {
      /**
       * Adds username, roles, and invitationId to JWT token when user signs in.
       */
      async jwt({ token, user }) {
        if (user?.username) {
          token.username = user.username;
        }

        if (user?.roles) {
          token.roles = user.roles;
        }

        if (user?.invitationId) {
          token.invitationId = user.invitationId;
        }

        return token;
      },

      /**
       * Adds username, roles, and invitationId to session object from JWT token.
       */
      async session({ session, token }) {
        if (token.username && session.user) {
          session.user.username = token.username as string;
        }

        if (token.roles && session.user) {
          session.user.roles = token.roles as string[];
        }

        if (token.invitationId && session.user) {
          session.user.invitationId = token.invitationId as string;
        }

        return session;
      },
    },

    pages: {
      signIn: '/login',
      error: '/login',
    },

    session: {
      strategy: 'jwt',
    },
  });
}

/**
 * Get auth instance with automatic environment detection.
 * Uses Cloudflare context when available, falls back to local development.
 */
function getAuthInstance() {
  let env: CloudflareEnv | undefined;

  try {
    const context = getCloudflareContext();
    env = context?.env;
  } catch {
    // Not in Cloudflare context, use local development
    env = undefined;
  }

  return createAuth(env);
}

/**
 * Get current session with automatic environment detection.
 */
export async function auth() {
  const authInstance = getAuthInstance();

  return authInstance.auth();
}

/**
 * Sign in function with automatic environment detection.
 */
export async function signIn(
  ...args: Parameters<ReturnType<typeof createAuth>['signIn']>
) {
  const authInstance = getAuthInstance();

  return authInstance.signIn(...args);
}

/**
 * Sign out function with automatic environment detection.
 */
export async function signOut(
  ...args: Parameters<ReturnType<typeof createAuth>['signOut']>
) {
  const authInstance = getAuthInstance();

  return authInstance.signOut(...args);
}

/**
 * Resolves the caller's identity from a session.
 *
 * Replaces `isGuestAuthenticated`. Call this in every server component or
 * server action that needs to gate behaviour on authentication status.
 *
 * @param session - The session object returned by `auth()`, or null.
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
