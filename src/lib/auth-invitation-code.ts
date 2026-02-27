/**
 * Invitation code authorization logic.
 *
 * Kept separate from auth.ts to allow unit testing without importing the full
 * NextAuth stack. Mirrors the pattern established in auth-credentials.ts.
 */
import { sql, eq } from 'drizzle-orm';
import { invitations, users } from '@/lib/db/schema';
import type { DbClient } from '@/lib/db';

/**
 * Authenticates a guest via their invitation code.
 *
 * Performs a case-insensitive code lookup. On success, upserts a User record
 * linked to the invitation (creating one on first visit, reusing on return).
 * Returns a user object containing the invitation ID for session injection.
 *
 * @param credentials - Submitted form credentials; expects `invitationCode`.
 * @param db - Drizzle database client.
 * @returns Authorized user object, or null if the code is invalid/not found.
 */
export async function authorizeInvitationCode(
  credentials: Partial<Record<string, unknown>>,
  db: DbClient,
): Promise<{
  id: string;
  name: string;
  email: string | null;
  invitationId: string;
  roles: ['guest'];
} | null> {
  const rawCode = credentials?.invitationCode;

  if (!rawCode || typeof rawCode !== 'string' || rawCode.trim() === '') {
    return null;
  }

  const normalizedCode = rawCode.trim().toLowerCase();

  // Case-insensitive lookup against the invitation table
  const invitation = await db.query.invitations.findFirst({
    where: () =>
      sql`${invitations.invitationCode} = ${normalizedCode} COLLATE NOCASE`,
  });

  if (!invitation) {
    console.error(
      `[auth-invitation-code] Invalid or unrecognised code attempt: "${normalizedCode}"`,
    );

    return null;
  }

  let userId = invitation.userId;

  if (userId) {
    const existingUser = await db.query.users.findFirst({
      where: (table) => eq(table.id, userId as string),
    });

    // If the linked user was deleted, fall through to create a new one
    if (!existingUser) {
      userId = null;
    }
  }

  if (!userId) {
    const newUserId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(users).values({
      id: newUserId,
      name: 'Invitation',
      email: null,
      createdAt: now,
      updatedAt: now,
    });

    await db
      .update(invitations)
      .set({ userId: newUserId, updatedAt: now })
      .where(eq(invitations.id, invitation.id));

    userId = newUserId;

    console.error(
      `[auth-invitation-code] Created new user "${newUserId}" for invitation "${invitation.id}"`,
    );
  }

  return {
    id: userId,
    name: 'Invitation',
    email: null,
    invitationId: invitation.id,
    roles: ['guest'],
  };
}
