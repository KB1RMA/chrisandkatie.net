/**
 * Auth.js v5 configuration for guest authentication.
 *
 * Uses a custom credentials provider that authenticates guests by name lookup.
 * Stores session data in D1 via Drizzle adapter.
 */
import NextAuth, { type DefaultSession } from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import Credentials from 'next-auth/providers/credentials';
import { getDb } from '@/lib/db';
import { accounts, sessions, users, verificationTokens } from '@/lib/db/schema';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export { authorizeCredentials } from '@/lib/auth-credentials';
import { authorizeCredentials } from '@/lib/auth-credentials';

/**
 * Extends the default session to include guest ID, first name, and roles.
 */
declare module 'next-auth' {
  interface Session {
    user: {
      guestId?: string;
      firstName?: string;
      roles?: string[];
    } & DefaultSession['user'];
  }

  interface User {
    guestId?: string;
    firstName?: string;
    roles?: string[];
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    guestId?: string;
    firstName?: string;
    roles?: string[];
  }
}

/**
 * Creates Next Auth v5 configuration.
 *
 * @param env - Optional Cloudflare environment bindings (for D1)
 * @returns NextAuth instance with auth(), signIn(), signOut() handlers
 */
export function createAuth(env?: CloudflareEnv) {
  const db = getDb();

  // In Cloudflare Workers, env vars are in the env binding, not process.env
  // NextAuth reads from process.env internally, so we need to set them explicitly
  if (env?.AUTH_SECRET) {
    process.env.AUTH_SECRET = env.AUTH_SECRET;
  }

  if (env?.NEXTAUTH_URL) {
    process.env.NEXTAUTH_URL = env.NEXTAUTH_URL;
  }

  return NextAuth({
    trustHost: true, // Required for Cloudflare Workers with custom domains
    adapter: DrizzleAdapter(db, {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),

    providers: [
      Credentials({
        name: 'Guest Login',
        credentials: {
          firstName: { label: 'First Name', type: 'text' },
          lastName: { label: 'Last Name', type: 'text' },
        },

        /**
         * Authenticates a user — first checks admin credentials, then falls
         * through to guest name lookup.
         */
        async authorize(credentials) {
          return authorizeCredentials(credentials);
        },
      }),
    ],

    callbacks: {
      /**
       * Adds guestId, firstName, and roles to JWT token when user signs in.
       */
      async jwt({ token, user }) {
        if (user?.guestId) {
          token.guestId = user.guestId;
        }

        if (user?.firstName) {
          token.firstName = user.firstName;
        }

        if (user?.roles) {
          token.roles = user.roles;
        }

        return token;
      },

      /**
       * Adds guestId, firstName, and roles to session object from JWT token.
       */
      async session({ session, token }) {
        if (token.guestId && session.user) {
          session.user.guestId = token.guestId as string;
        }

        if (token.firstName && session.user) {
          session.user.firstName = token.firstName as string;
        }

        if (token.roles && session.user) {
          session.user.roles = token.roles as string[];
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
