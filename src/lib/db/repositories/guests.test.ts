/**
 * @vitest-environment node
 */

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

import { expect, test, describe, beforeEach, vi } from 'vitest';
import { getDb } from '@/lib/db';
import type { DbClient } from '@/lib/db';
import { createGuest, deleteGuest } from './guests';
import type { NewGuestData } from './guests';

const mockGetDb = vi.mocked(getDb);

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

/**
 * Creates a mock Drizzle database for testing guest repository functions.
 *
 * @param overrides - Methods to override on the mock database.
 * @returns Partial DbClient with mocked methods.
 */
function createMockDb(
  overrides: Partial<{
    insertValues: ReturnType<typeof vi.fn>;
    deleteWhere: ReturnType<typeof vi.fn>;
  }> = {},
): DbClient {
  const insertValuesFn =
    overrides.insertValues ?? vi.fn().mockResolvedValue(undefined);
  const insertFn = vi.fn().mockReturnValue({ values: insertValuesFn });

  const deleteWhereFn =
    overrides.deleteWhere ?? vi.fn().mockResolvedValue(undefined);
  const deleteFn = vi.fn().mockReturnValue({ where: deleteWhereFn });

  return {
    insert: insertFn,
    delete: deleteFn,
  } as unknown as DbClient;
}

/** Creates a minimal NewGuestData fixture. */
function makeNewGuestData(overrides: Partial<NewGuestData> = {}): NewGuestData {
  return {
    id: 'guest-uuid-1',
    invitationId: 'invitation-uuid-1',
    firstName: 'Jane',
    lastName: 'Doe',
    type: 'adult',
    ...overrides,
  };
}

describe('createGuest', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('should insert a guest row with the correct fields', async () => {
    const insertValuesFn = vi.fn().mockResolvedValue(undefined);
    const mockDb = createMockDb({ insertValues: insertValuesFn });

    mockGetDb.mockReturnValue(mockDb);

    const data = makeNewGuestData();

    await createGuest(data);

    expect(mockDb.insert).toHaveBeenCalledOnce();
    expect(insertValuesFn).toHaveBeenCalledWith(
      expect.objectContaining({
        id: data.id,
        invitationId: data.invitationId,
        firstName: data.firstName,
        lastName: data.lastName,
        type: data.type,
      }),
    );
  });

  test('should supply createdAt and updatedAt timestamps', async () => {
    const insertValuesFn = vi.fn().mockResolvedValue(undefined);
    const mockDb = createMockDb({ insertValues: insertValuesFn });

    mockGetDb.mockReturnValue(mockDb);

    await createGuest(makeNewGuestData());

    const inserted = insertValuesFn.mock.calls[0][0];

    expect(inserted).toHaveProperty('createdAt');
    expect(inserted).toHaveProperty('updatedAt');
  });

  test('should call getDb once', async () => {
    const mockDb = createMockDb();

    mockGetDb.mockReturnValue(mockDb);

    await createGuest(makeNewGuestData());

    expect(mockGetDb).toHaveBeenCalledOnce();
  });
});

describe('deleteGuest', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('should delete a guest row with the correct id', async () => {
    const deleteWhereFn = vi.fn().mockResolvedValue(undefined);
    const mockDb = createMockDb({ deleteWhere: deleteWhereFn });

    mockGetDb.mockReturnValue(mockDb);

    await deleteGuest('guest-uuid-1');

    expect(mockDb.delete).toHaveBeenCalledOnce();
    expect(deleteWhereFn).toHaveBeenCalledOnce();
  });

  test('should call getDb once', async () => {
    const mockDb = createMockDb();

    mockGetDb.mockReturnValue(mockDb);

    await deleteGuest('guest-uuid-1');

    expect(mockGetDb).toHaveBeenCalledOnce();
  });
});
