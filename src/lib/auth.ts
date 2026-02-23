/**
 * Auth.js v5 configuration for guest authentication.
 *
 * Uses a custom credentials provider that authenticates guests by name lookup.
 * Stores session data in D1 via Drizzle adapter.
 */
import NextAuth, { type DefaultSession } from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import Credentials from 'next-auth/providers/credentials';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import {
  accounts,
  guests,
  sessions,
  users,
  verificationTokens,
} from '@/lib/db/schema';
import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Extends the default session to include guest ID.
 */
declare module 'next-auth' {
  interface Session {
    user: {
      guestId?: string;
    } & DefaultSession['user'];
  }

  interface User {
    guestId?: string;
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    guestId?: string;
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
         * Authenticates a guest by looking up their name in the database.
         * Creates a User record if guest exists but has no linked user.
         */
        async authorize(credentials) {
          if (!credentials?.firstName || !credentials?.lastName) {
            return null;
          }

          // Case-insensitive name match
          const firstName = (credentials.firstName as string).trim();
          const lastName = (credentials.lastName as string).trim();

          const guest = await db.query.guests.findFirst({
            where: (table) =>
              sql`LOWER(${table.firstName}) = LOWER(${firstName}) AND LOWER(${table.lastName}) = LOWER(${lastName})`,
          });

          if (!guest) {
            return null;
          }

          let userId = guest.userId;
          let userName = `${guest.firstName} ${guest.lastName}`;
          let userEmail: string | null = null;

          if (userId) {
            const existingUser = await db.query.users.findFirst({
              where: (table) => eq(table.id, userId as string),
            });

            if (existingUser) {
              userName = existingUser.name ?? userName;
              userEmail = existingUser.email ?? null;
            } else {
              userId = null;
            }
          }

          if (!userId) {
            const newUserId = crypto.randomUUID();

            const now = new Date().toISOString();

            await db.insert(users).values({
              id: newUserId,
              name: userName,
              email: null,
              createdAt: now,
              updatedAt: now,
            });

            await db
              .update(guests)
              .set({ userId: newUserId })
              .where(eq(guests.id, guest.id));

            userId = newUserId;
          }

          return {
            id: userId,
            name: userName,
            email: userEmail,
            guestId: guest.id,
          };
        },
      }),
    ],

    callbacks: {
      /**
       * Adds guestId to JWT token when user signs in.
       */
      async jwt({ token, user }) {
        if (user?.guestId) {
          token.guestId = user.guestId;
        }

        return token;
      },

      /**
       * Adds guestId to session object from JWT token.
       */
      async session({ session, token }) {
        if (token.guestId && session.user) {
          session.user.guestId = token.guestId as string;
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
