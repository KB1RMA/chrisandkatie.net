/**
 * @vitest-environment node
 */

import { expect, test, describe, beforeEach, vi } from 'vitest';
import { authorizeCredentials } from '@/lib/auth-credentials';

describe('authorizeCredentials', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
  });

  test('should return null when username is missing', async () => {
    const result = await authorizeCredentials({ password: 'secret' });

    expect(result).toBeNull();
  });

  test('should return null when password is missing', async () => {
    const result = await authorizeCredentials({ username: 'admin' });

    expect(result).toBeNull();
  });

  test('should return null when both credentials are missing', async () => {
    const result = await authorizeCredentials({});

    expect(result).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Tests — admin credential validation
  // ---------------------------------------------------------------------------

  describe('admin credential check', () => {
    test('should return null when ADMIN_USERNAME env var is not set', async () => {
      vi.stubEnv('ADMIN_PASSWORD', 'adminpass');

      const result = await authorizeCredentials({
        username: 'adminuser',
        password: 'adminpass',
      });

      expect(result).toBeNull();
    });

    test('should return null when ADMIN_PASSWORD env var is not set', async () => {
      vi.stubEnv('ADMIN_USERNAME', 'adminuser');

      const result = await authorizeCredentials({
        username: 'adminuser',
        password: 'adminpass',
      });

      expect(result).toBeNull();
    });

    test('should return admin user object when credentials match env vars exactly', async () => {
      vi.stubEnv('ADMIN_USERNAME', 'adminuser');
      vi.stubEnv('ADMIN_PASSWORD', 'adminpass');

      const result = await authorizeCredentials({
        username: 'adminuser',
        password: 'adminpass',
      });

      expect(result).toEqual({
        id: 'admin',
        name: 'Admin',
        email: null,
        username: 'adminuser',
        roles: ['admin'],
      });
    });

    test('should return null when credentials do not match env vars', async () => {
      vi.stubEnv('ADMIN_USERNAME', 'adminuser');
      vi.stubEnv('ADMIN_PASSWORD', 'adminpass');

      const result = await authorizeCredentials({
        username: 'wrong',
        password: 'wrong',
      });

      expect(result).toBeNull();
    });
  });
});
