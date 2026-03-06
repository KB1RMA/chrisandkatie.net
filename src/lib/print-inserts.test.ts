/**
 * @vitest-environment node
 */

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

import { describe, expect, test, vi } from 'vitest';
import { buildInviteDeepLink } from '@/lib/print-inserts';

describe('buildInviteDeepLink', () => {
  test('should build deep link for a standard code', () => {
    expect(buildInviteDeepLink('swift-panda')).toBe(
      'https://chrisandkatie.net/login?code=swift-panda',
    );
  });

  test('should percent-encode special characters in the code', () => {
    expect(buildInviteDeepLink('bright+star')).toBe(
      'https://chrisandkatie.net/login?code=bright%2Bstar',
    );
  });

  test('should build deep link for an empty code', () => {
    expect(buildInviteDeepLink('')).toBe(
      'https://chrisandkatie.net/login?code=',
    );
  });
});
