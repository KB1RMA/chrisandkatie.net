/**
 * Auth.js v5 configuration for guest authentication.
 *
 * Uses a custom credentials provider that authenticates guests by name lookup.
 * Stores session data in D1/SQLite via Prisma adapter.
 */
import NextAuth, { type DefaultSession } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import { getPrismaClient } from '@/lib/db';

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
  const prisma = getPrismaClient(env);

  return NextAuth({
    adapter: PrismaAdapter(prisma),

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

          // Case-insensitive name search using LIKE
          const firstName = (credentials.firstName as string).trim();
          const lastName = (credentials.lastName as string).trim();

          const guest = await prisma.guest.findFirst({
            where: {
              AND: [
                {
                  firstName: {
                    contains: firstName,
                  },
                },
                {
                  lastName: {
                    contains: lastName,
                  },
                },
              ],
            },
            include: {
              user: true,
            },
          });

          if (!guest) {
            return null;
          }

          let user = guest.user;

          // Create user if guest doesn't have one yet
          if (!user) {
            user = await prisma.user.create({
              data: {
                name: `${guest.firstName} ${guest.lastName}`,
                email: null,
                guest: {
                  connect: {
                    id: guest.id,
                  },
                },
              },
            });
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
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

// Default auth instance for local development
export const { auth, signIn, signOut, handlers } = createAuth();
