/**
 * Credential authorization logic for the guest and admin login flows.
 *
 * Kept separate from auth.ts to allow unit testing without importing the
 * full NextAuth stack (which depends on next/server at runtime).
 */
import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { guests, users } from '@/lib/db/schema';

/**
 * Handles credential authorization — first checks admin env vars, then falls
 * through to guest name lookup in the database.
 *
 * @param credentials - The submitted first name and last name credentials.
 * @returns Authorized user object, or null if unauthorized.
 */
export async function authorizeCredentials(
  credentials: Partial<Record<'firstName' | 'lastName', unknown>>,
) {
  if (!credentials?.firstName || !credentials?.lastName) {
    return null;
  }

  // Admin credential check — runs before guest lookup
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (
    adminUsername &&
    adminPassword &&
    credentials.firstName === adminUsername &&
    credentials.lastName === adminPassword
  ) {
    return {
      id: 'admin',
      name: 'Admin',
      email: null,
      roles: ['admin'],
    };
  }

  const db = getDb();

  // Case-insensitive name match
  const firstName = (credentials.firstName as string).trim();
  const lastName = (credentials.lastName as string).trim();

  const guest = await db.query.guests.findFirst({
    where: (table) =>
      sql`${table.firstName} = ${firstName} COLLATE NOCASE AND ${table.lastName} = ${lastName} COLLATE NOCASE`,
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
    firstName: guest.firstName,
  };
}
