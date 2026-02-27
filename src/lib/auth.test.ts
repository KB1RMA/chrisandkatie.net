/**
 * @vitest-environment node
 */

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn().mockReturnValue(undefined),
}));

vi.mock('next-auth', () => ({
  default: vi.fn().mockReturnValue({
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    handlers: {},
  }),
}));

vi.mock('next-auth/providers/credentials', () => ({
  default: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/auth-invitation-code', () => ({
  authorizeInvitationCode: vi.fn(),
}));

vi.mock('@/lib/auth-credentials', () => ({
  authorizeCredentials: vi.fn(),
}));

import { expect, test, describe } from 'vitest';
import type { Session } from 'next-auth';
import { getAuthIdentity } from '@/lib/auth';

describe('getAuthIdentity', () => {
  test('should return null when session is null', () => {
    const result = getAuthIdentity(null);

    expect(result).toBeNull();
  });

  test('should return admin identity when session has admin role and username', () => {
    const session: Session = {
      user: {
        username: 'adminuser',
        roles: ['admin'],
      },
      expires: new Date(Date.now() + 3600000).toISOString(),
    };

    const result = getAuthIdentity(session);

    expect(result).toEqual({ type: 'admin', username: 'adminuser' });
  });

  test('should return guest identity when session has invitationId', () => {
    const session: Session = {
      user: {
        invitationId: 'inv-abc-123',
      },
      expires: new Date(Date.now() + 3600000).toISOString(),
    };

    const result = getAuthIdentity(session);

    expect(result).toEqual({ type: 'guest', invitationId: 'inv-abc-123' });
  });

  test('should return null when session has neither admin roles/username nor invitationId', () => {
    const session: Session = {
      user: {},
      expires: new Date(Date.now() + 3600000).toISOString(),
    };

    const result = getAuthIdentity(session);

    expect(result).toBeNull();
  });
});
