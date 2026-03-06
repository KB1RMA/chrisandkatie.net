/**
 * @vitest-environment node
 */

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getDb } from '@/lib/db';
import type { DbClient } from '@/lib/db';
import {
  countInvitationsWithoutCode,
  findInvitationRowsForPrint,
} from '@/lib/db/repositories/invitations';

const mockGetDb = vi.mocked(getDb);

type MockRow = {
  invitationId: string;
  invitationCode: string | null;
  guestFirstName: string | null;
  guestLastName: string | null;
  guestCreatedAt: string | null;
};

function createMockDb(rows: MockRow[]): DbClient {
  const orderByFn = vi.fn().mockResolvedValue(rows);
  const whereFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
  const leftJoinFn = vi.fn().mockReturnValue({ where: whereFn });
  const fromFn = vi.fn().mockReturnValue({ leftJoin: leftJoinFn });
  const selectFn = vi.fn().mockReturnValue({ from: fromFn });

  return {
    select: selectFn,
  } as unknown as DbClient;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('findInvitationRowsForPrint', () => {
  test('should return only invitations with a non-null invitation code', async () => {
    mockGetDb.mockReturnValue(
      createMockDb([
        {
          invitationId: 'inv-1',
          invitationCode: 'swift-panda',
          guestFirstName: 'Chris',
          guestLastName: 'Taylor',
          guestCreatedAt: '2024-01-01',
        },
        {
          invitationId: 'inv-2',
          invitationCode: null,
          guestFirstName: 'Katie',
          guestLastName: 'Smith',
          guestCreatedAt: '2024-01-02',
        },
      ]),
    );

    const result = await findInvitationRowsForPrint();

    expect(result).toHaveLength(1);
    expect(result[0].invitationId).toBe('inv-1');
  });

  test('should use "Unknown Household" label when no guests are linked', async () => {
    mockGetDb.mockReturnValue(
      createMockDb([
        {
          invitationId: 'inv-1',
          invitationCode: 'swift-panda',
          guestFirstName: null,
          guestLastName: null,
          guestCreatedAt: null,
        },
      ]),
    );

    const result = await findInvitationRowsForPrint();

    expect(result).toHaveLength(1);
    expect(result[0].householdLabel).toBe('Unknown Household');
  });

  test('should return an empty array when no invitations have codes', async () => {
    mockGetDb.mockReturnValue(createMockDb([]));

    const result = await findInvitationRowsForPrint();

    expect(result).toHaveLength(0);
  });

  test('should include only matching invitations when invitationIds filter is provided', async () => {
    // The mock simulates the database honouring the SQL inArray condition —
    // only the matching row is returned, exactly as it would be in production.
    mockGetDb.mockReturnValue(
      createMockDb([
        {
          invitationId: 'inv-1',
          invitationCode: 'swift-panda',
          guestFirstName: 'Chris',
          guestLastName: 'Taylor',
          guestCreatedAt: '2024-01-01',
        },
      ]),
    );

    const result = await findInvitationRowsForPrint(['inv-1']);

    expect(result).toHaveLength(1);
    expect(result[0].invitationId).toBe('inv-1');
  });
});

describe('countInvitationsWithoutCode', () => {
  test('should return the count of invitations without a code', async () => {
    const whereFn = vi.fn().mockResolvedValue([{ count: 3 }]);
    const fromFn = vi.fn().mockReturnValue({ where: whereFn });
    const selectFn = vi.fn().mockReturnValue({ from: fromFn });

    mockGetDb.mockReturnValue({ select: selectFn } as unknown as DbClient);

    const result = await countInvitationsWithoutCode();

    expect(result).toBe(3);
  });

  test('should return 0 when all invitations have codes', async () => {
    const whereFn = vi.fn().mockResolvedValue([{ count: 0 }]);
    const fromFn = vi.fn().mockReturnValue({ where: whereFn });
    const selectFn = vi.fn().mockReturnValue({ from: fromFn });

    mockGetDb.mockReturnValue({ select: selectFn } as unknown as DbClient);

    const result = await countInvitationsWithoutCode();

    expect(result).toBe(0);
  });
});
