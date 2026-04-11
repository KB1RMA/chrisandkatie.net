/**
 * @vitest-environment node
 */

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  getAuthIdentity: vi.fn(),
}));

import { jwtVerify } from 'jose';
import { describe, expect, test, beforeEach, vi } from 'vitest';
import { auth, getAuthIdentity } from '@/lib/auth';
import { makeSession } from '@/tests/helpers';
import { GET } from './route';

const mockAuth = vi.mocked(auth);
const mockGetAuthIdentity = vi.mocked(getAuthIdentity);

const TEST_SECRET = 'test-auth-secret-at-least-32-chars-long!!';

describe('GET /api/photo-booth/ws-token', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.AUTH_SECRET = TEST_SECRET;
  });

  test('should return 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    mockGetAuthIdentity.mockReturnValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  test('should return 500 when AUTH_SECRET is not configured', async () => {
    mockAuth.mockResolvedValue(makeSession({ invitationId: 'inv-1' }));
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'inv-1',
    });
    delete process.env.AUTH_SECRET;

    const response = await GET();

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: 'AUTH_SECRET is not configured' });
  });

  test('should return a signed JWT for a guest session', async () => {
    mockAuth.mockResolvedValue(makeSession({ invitationId: 'inv-abc' }));
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'inv-abc',
    });

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json() as { token: string };
    expect(typeof body.token).toBe('string');

    const keyBytes = new TextEncoder().encode(TEST_SECRET);
    const { payload } = await jwtVerify(body.token, keyBytes, {
      audience: 'partykit-ws',
    });

    expect(payload.sub).toBe('inv-abc');
    expect(payload.aud).toBe('partykit-ws');
    expect(typeof payload.exp).toBe('number');
    expect(payload.exp!).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(payload.exp!).toBeLessThanOrEqual(
      Math.floor(Date.now() / 1000) + 30,
    );
  });

  test('should return a signed JWT for an admin session', async () => {
    mockAuth.mockResolvedValue(
      makeSession({ username: 'admin', roles: ['admin'] }),
    );
    mockGetAuthIdentity.mockReturnValue({
      type: 'admin',
      username: 'admin',
    });

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json() as { token: string };

    const keyBytes = new TextEncoder().encode(TEST_SECRET);
    const { payload } = await jwtVerify(body.token, keyBytes, {
      audience: 'partykit-ws',
    });

    expect(payload.sub).toBe('admin');
  });
});
