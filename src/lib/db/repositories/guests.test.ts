/**
 * @vitest-environment node
 */

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

import { expect, test, describe, beforeEach, vi } from 'vitest';
import { getDb } from '@/lib/db';
import type { DbClient } from '@/lib/db';
import { createGuest, deleteGuest, findGuestsForVenueExport } from './guests';
import type { NewGuestData, VenueExportRow } from './guests';

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

/**
 * Creates a mock Drizzle database whose select → from → leftJoin → leftJoin
 * → leftJoin → orderBy chain resolves to the given venue export rows.
 *
 * @param rows - The rows the query chain should resolve with.
 * @returns The mock DbClient plus the chain spies for assertions.
 */
function createVenueExportDb(rows: VenueExportRow[]) {
  const orderByFn = vi.fn().mockResolvedValue(rows);
  const leftJoinFn = vi.fn();
  const chain = { leftJoin: leftJoinFn, orderBy: orderByFn };
  leftJoinFn.mockReturnValue(chain);
  const fromFn = vi.fn().mockReturnValue(chain);
  const selectFn = vi.fn().mockReturnValue({ from: fromFn });

  const db = { select: selectFn } as unknown as DbClient;

  return { db, selectFn, fromFn, leftJoinFn, orderByFn };
}

/** Creates a minimal VenueExportRow fixture. */
function makeVenueExportRow(
  overrides: Partial<VenueExportRow> = {},
): VenueExportRow {
  return {
    guestId: 'guest-uuid-1',
    firstName: 'Jane',
    lastName: 'Doe',
    type: 'adult',
    attending: true,
    mealChoice: 'short-rib',
    dietaryRestrictions: null,
    notes: null,
    partyName: 'Doe Family',
    tableName: null,
    ...overrides,
  };
}

describe('findGuestsForVenueExport', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('should resolve with the flattened venue export rows', async () => {
    const rows = [
      makeVenueExportRow(),
      makeVenueExportRow({ guestId: 'guest-uuid-2', attending: null }),
    ];
    const { db } = createVenueExportDb(rows);

    mockGetDb.mockReturnValue(db);

    await expect(findGuestsForVenueExport()).resolves.toEqual(rows);
  });

  test('should select all VenueExportRow columns', async () => {
    const { db, selectFn } = createVenueExportDb([]);

    mockGetDb.mockReturnValue(db);

    await findGuestsForVenueExport();

    const selection = selectFn.mock.calls[0][0];

    expect(Object.keys(selection).sort()).toEqual(
      Object.keys(makeVenueExportRow()).sort(),
    );
  });

  test('should left-join invitations, seating assignments, and seating tables, then order by party then guest name', async () => {
    const { db, leftJoinFn, orderByFn } = createVenueExportDb([]);

    mockGetDb.mockReturnValue(db);

    await findGuestsForVenueExport();

    expect(leftJoinFn).toHaveBeenCalledTimes(3);
    expect(orderByFn).toHaveBeenCalledOnce();
    expect(orderByFn.mock.calls[0]).toHaveLength(3);
  });

  test('should resolve rows when called without an eventId', async () => {
    const rows = [makeVenueExportRow()];
    const { db } = createVenueExportDb(rows);

    mockGetDb.mockReturnValue(db);

    await expect(findGuestsForVenueExport()).resolves.toEqual(rows);
  });

  test('should resolve rows when called with an eventId', async () => {
    const rows = [makeVenueExportRow({ tableName: 'Table 3' })];
    const { db } = createVenueExportDb(rows);

    mockGetDb.mockReturnValue(db);

    await expect(findGuestsForVenueExport('event-uuid-1')).resolves.toEqual(
      rows,
    );
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
