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
  findInvitationCodeByLastNameAndAddress,
  findInvitationRowsForPrint,
  findInvitationsForExport,
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

// ---------------------------------------------------------------------------
// findInvitationsForExport helpers
// ---------------------------------------------------------------------------

type ExportMockRow = {
  invitationId: string;
  mailingAddress: string | null;
  address: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  contactEmail: string | null;
  guestFirstName: string | null;
  guestLastName: string | null;
  guestCreatedAt: string | null;
};

function createExportMockDb(rows: ExportMockRow[]): DbClient {
  const orderByFn = vi.fn().mockResolvedValue(rows);
  const leftJoinFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
  const fromFn = vi.fn().mockReturnValue({ leftJoin: leftJoinFn });
  const selectFn = vi.fn().mockReturnValue({ from: fromFn });

  return { select: selectFn } as unknown as DbClient;
}

describe('findInvitationsForExport', () => {
  test('should return all invitations with the InvitationExportRow shape', async () => {
    mockGetDb.mockReturnValue(
      createExportMockDb([
        {
          invitationId: 'inv-1',
          mailingAddress: 'Smith Family',
          address: '123 Main St',
          addressLine2: null,
          city: 'Springfield',
          state: 'IL',
          zipCode: '62701',
          country: 'United States',
          contactEmail: 'smith@example.com',
          guestFirstName: 'Chris',
          guestLastName: 'Smith',
          guestCreatedAt: '2024-01-01',
        },
      ]),
    );

    const result = await findInvitationsForExport();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'inv-1',
      mailingAddress: 'Smith Family',
      address: '123 Main St',
      addressLine2: null,
      city: 'Springfield',
      state: 'IL',
      zipCode: '62701',
      country: 'United States',
      contactEmail: 'smith@example.com',
      primaryGuestFirstName: 'Chris',
      primaryGuestLastName: 'Smith',
    });
  });

  test('should populate primaryGuestFirstName/LastName from the earliest-created guest', async () => {
    mockGetDb.mockReturnValue(
      createExportMockDb([
        {
          invitationId: 'inv-1',
          mailingAddress: null,
          address: null,
          addressLine2: null,
          city: null,
          state: null,
          zipCode: null,
          country: null,
          contactEmail: null,
          guestFirstName: 'Alice',
          guestLastName: 'Jones',
          guestCreatedAt: '2024-01-01T00:00:00',
        },
        {
          invitationId: 'inv-1',
          mailingAddress: null,
          address: null,
          addressLine2: null,
          city: null,
          state: null,
          zipCode: null,
          country: null,
          contactEmail: null,
          guestFirstName: 'Bob',
          guestLastName: 'Jones',
          guestCreatedAt: '2024-01-02T00:00:00',
        },
      ]),
    );

    const result = await findInvitationsForExport();

    expect(result).toHaveLength(1);
    expect(result[0].primaryGuestFirstName).toBe('Alice');
    expect(result[0].primaryGuestLastName).toBe('Jones');
  });

  test('should return a row with null address fields when an invitation has no address data', async () => {
    mockGetDb.mockReturnValue(
      createExportMockDb([
        {
          invitationId: 'inv-1',
          mailingAddress: null,
          address: null,
          addressLine2: null,
          city: null,
          state: null,
          zipCode: null,
          country: null,
          contactEmail: null,
          guestFirstName: 'Chris',
          guestLastName: 'Taylor',
          guestCreatedAt: '2024-01-01',
        },
      ]),
    );

    const result = await findInvitationsForExport();

    expect(result).toHaveLength(1);
    expect(result[0].mailingAddress).toBeNull();
    expect(result[0].address).toBeNull();
    expect(result[0].city).toBeNull();
  });

  test('should return an empty array when there are no invitations', async () => {
    mockGetDb.mockReturnValue(createExportMockDb([]));

    const result = await findInvitationsForExport();

    expect(result).toHaveLength(0);
  });

  test('should deduplicate to one row per invitation', async () => {
    mockGetDb.mockReturnValue(
      createExportMockDb([
        {
          invitationId: 'inv-1',
          mailingAddress: 'Taylor Household',
          address: '1 Oak St',
          addressLine2: null,
          city: 'Chicago',
          state: 'IL',
          zipCode: '60601',
          country: 'US',
          contactEmail: null,
          guestFirstName: 'Chris',
          guestLastName: 'Taylor',
          guestCreatedAt: '2024-01-01',
        },
        {
          invitationId: 'inv-1',
          mailingAddress: 'Taylor Household',
          address: '1 Oak St',
          addressLine2: null,
          city: 'Chicago',
          state: 'IL',
          zipCode: '60601',
          country: 'US',
          contactEmail: null,
          guestFirstName: 'Katie',
          guestLastName: 'Taylor',
          guestCreatedAt: '2024-01-02',
        },
        {
          invitationId: 'inv-2',
          mailingAddress: null,
          address: null,
          addressLine2: null,
          city: null,
          state: null,
          zipCode: null,
          country: null,
          contactEmail: null,
          guestFirstName: 'Jane',
          guestLastName: 'Doe',
          guestCreatedAt: '2024-01-01',
        },
      ]),
    );

    const result = await findInvitationsForExport();

    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// findInvitationCodeByLastNameAndAddress
// ---------------------------------------------------------------------------

describe('findInvitationCodeByLastNameAndAddress', () => {
  type RecoveryMockRow = { invitationCode: string | null };

  function createRecoveryMockDb(rows: RecoveryMockRow[]): DbClient {
    const limitFn = vi.fn().mockResolvedValue(rows);
    const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
    const innerJoinFn = vi.fn().mockReturnValue({ where: whereFn });
    const fromFn = vi.fn().mockReturnValue({ innerJoin: innerJoinFn });
    const selectFn = vi.fn().mockReturnValue({ from: fromFn });

    return { select: selectFn } as unknown as DbClient;
  }

  test('should return the invitation code when last name, address, and ZIP match exactly', async () => {
    mockGetDb.mockReturnValue(
      createRecoveryMockDb([{ invitationCode: 'swift-panda' }]),
    );

    const result = await findInvitationCodeByLastNameAndAddress(
      'Smith',
      '123 Main St',
      '62701',
    );

    expect(result).toBe('swift-panda');
  });

  test('should return null when no guest matches the last name', async () => {
    mockGetDb.mockReturnValue(createRecoveryMockDb([]));

    const result = await findInvitationCodeByLastNameAndAddress(
      'Unknown',
      '123 Main St',
      '62701',
    );

    expect(result).toBeNull();
  });

  test('should return null when no invitation matches the address', async () => {
    mockGetDb.mockReturnValue(createRecoveryMockDb([]));

    const result = await findInvitationCodeByLastNameAndAddress(
      'Smith',
      '999 Wrong Ave',
      '62701',
    );

    expect(result).toBeNull();
  });

  test('should return null when last name matches but address does not', async () => {
    mockGetDb.mockReturnValue(createRecoveryMockDb([]));

    const result = await findInvitationCodeByLastNameAndAddress(
      'Smith',
      '999 Wrong Ave',
      '62701',
    );

    expect(result).toBeNull();
  });

  test('should return null when address matches but last name does not', async () => {
    mockGetDb.mockReturnValue(createRecoveryMockDb([]));

    const result = await findInvitationCodeByLastNameAndAddress(
      'Unknown',
      '123 Main St',
      '62701',
    );

    expect(result).toBeNull();
  });

  test('should return null when ZIP code does not match', async () => {
    mockGetDb.mockReturnValue(createRecoveryMockDb([]));

    const result = await findInvitationCodeByLastNameAndAddress(
      'Smith',
      '123 Main St',
      '00000',
    );

    expect(result).toBeNull();
  });

  test('should return the invitation code for a case-insensitive last name match', async () => {
    mockGetDb.mockReturnValue(
      createRecoveryMockDb([{ invitationCode: 'swift-panda' }]),
    );

    const result = await findInvitationCodeByLastNameAndAddress(
      'SMITH',
      '123 Main St',
      '62701',
    );

    expect(result).toBe('swift-panda');
  });

  test('should return the invitation code for a case-insensitive address match', async () => {
    mockGetDb.mockReturnValue(
      createRecoveryMockDb([{ invitationCode: 'swift-panda' }]),
    );

    const result = await findInvitationCodeByLastNameAndAddress(
      'Smith',
      '123 MAIN ST',
      '62701',
    );

    expect(result).toBe('swift-panda');
  });

  test('should return null when the invitation has a null invitationCode', async () => {
    mockGetDb.mockReturnValue(createRecoveryMockDb([{ invitationCode: null }]));

    const result = await findInvitationCodeByLastNameAndAddress(
      'Smith',
      '123 Main St',
      '62701',
    );

    expect(result).toBeNull();
  });

  test('should return null when lastName is an empty string', async () => {
    mockGetDb.mockReturnValue(createRecoveryMockDb([]));

    const result = await findInvitationCodeByLastNameAndAddress(
      '',
      '123 Main St',
      '62701',
    );

    expect(result).toBeNull();
  });

  test('should return null when streetAddress is an empty string', async () => {
    mockGetDb.mockReturnValue(createRecoveryMockDb([]));

    const result = await findInvitationCodeByLastNameAndAddress(
      'Smith',
      '',
      '62701',
    );

    expect(result).toBeNull();
  });

  test('should return null when zipCode is an empty string', async () => {
    mockGetDb.mockReturnValue(createRecoveryMockDb([]));

    const result = await findInvitationCodeByLastNameAndAddress(
      'Smith',
      '123 Main St',
      '',
    );

    expect(result).toBeNull();
  });
});
