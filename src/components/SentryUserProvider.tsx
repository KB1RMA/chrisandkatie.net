'use client';

import * as Sentry from '@sentry/nextjs';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

/**
 * Syncs the authenticated user's identity to Sentry on the client.
 *
 * Must be rendered inside next-auth's SessionProvider. Calls Sentry.setUser()
 * whenever the session changes so that client-side errors and replays are
 * tagged with the invitation ID (guests) or username (admins).
 *
 * @returns null — renders no UI.
 */
export function SentryUserProvider() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user) {
      Sentry.setUser(null);

      return;
    }

    Sentry.setUser({
      id: session.user.invitationId ?? session.user.username,
      username: session.user.username,
      // Store invitationId explicitly so it's visible in Sentry's user panel
      // even when it is also used as the primary id.
      data: {
        invitationId: session.user.invitationId,
      },
    });
  }, [session]);

  return null;
}
