/**
 * @vitest-environment node
 */

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

import { expect, test, describe, beforeEach, vi } from 'vitest';
import { getDb } from '@/lib/db';
import type { DbClient } from '@/lib/db';
import {
  countAssignmentsForTable,
  deleteAssignmentForGuest,
  deleteSeatingTable,
  insertSeatingTables,
  updateSeatingTable,
  upsertAssignment,
} from './seating';

const mockGetDb = vi.mocked(getDb);

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

/**
 * Creates a mock Drizzle database for testing seating repository functions.
 *
 * @param overrides - Methods to override on the mock database.
 * @returns Partial DbClient with mocked methods.
 */
function createMockDb(
  overrides: Partial<{
    selectRows: unknown[];
    insertValues: ReturnType<typeof vi.fn>;
    updateWhere: ReturnType<typeof vi.fn>;
    deleteWhere: ReturnType<typeof vi.fn>;
  }> = {},
): DbClient {
  const selectWhereFn = vi.fn().mockResolvedValue(overrides.selectRows ?? []);
  const selectFromFn = vi.fn().mockReturnValue({ where: selectWhereFn });
  const selectFn = vi.fn().mockReturnValue({ from: selectFromFn });

  const insertValuesFn =
    overrides.insertValues ??
    vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
    });
  const insertFn = vi.fn().mockReturnValue({ values: insertValuesFn });

  const updateWhereFn =
    overrides.updateWhere ?? vi.fn().mockResolvedValue(undefined);
  const updateSetFn = vi.fn().mockReturnValue({ where: updateWhereFn });
  const updateFn = vi.fn().mockReturnValue({ set: updateSetFn });

  const deleteWhereFn =
    overrides.deleteWhere ?? vi.fn().mockResolvedValue(undefined);
  const deleteFn = vi.fn().mockReturnValue({ where: deleteWhereFn });

  return {
    select: selectFn,
    insert: insertFn,
    update: updateFn,
    delete: deleteFn,
  } as unknown as DbClient;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('countAssignmentsForTable', () => {
  test('should return the count from the aggregate row', async () => {
    mockGetDb.mockReturnValue(createMockDb({ selectRows: [{ count: 5 }] }));

    await expect(countAssignmentsForTable('table-1')).resolves.toBe(5);
  });

  test('should return 0 when no aggregate row is present', async () => {
    mockGetDb.mockReturnValue(createMockDb({ selectRows: [] }));

    await expect(countAssignmentsForTable('table-1')).resolves.toBe(0);
  });
});

describe('insertSeatingTables', () => {
  test('should no-op for an empty array', async () => {
    const db = createMockDb();

    mockGetDb.mockReturnValue(db);

    await insertSeatingTables([]);

    expect(db.insert).not.toHaveBeenCalled();
  });

  test('should insert the provided rows', async () => {
    const insertValues = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb({ insertValues });

    mockGetDb.mockReturnValue(db);

    const rows = [
      { id: 't1', eventId: 'event-main', name: 'Head Table', capacity: 8 },
      { id: 't2', eventId: 'event-main', name: 'Table 1', capacity: 8 },
    ];

    await insertSeatingTables(rows);

    expect(insertValues).toHaveBeenCalledWith(rows);
  });
});

describe('updateSeatingTable', () => {
  test('should write the new values and bump updatedAt', async () => {
    const db = createMockDb();

    mockGetDb.mockReturnValue(db);

    await updateSeatingTable('table-1', { name: 'Family', capacity: 10 });

    const setFn = vi.mocked(db.update('' as never).set);

    expect(setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Family',
        capacity: 10,
        updatedAt: expect.any(String),
      }),
    );
  });
});

describe('deleteSeatingTable', () => {
  test('should issue a delete for the table', async () => {
    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb({ deleteWhere });

    mockGetDb.mockReturnValue(db);

    await deleteSeatingTable('table-1');

    expect(db.delete).toHaveBeenCalled();
    expect(deleteWhere).toHaveBeenCalled();
  });
});

describe('upsertAssignment', () => {
  test('should insert with the next seatOrder after the current max', async () => {
    const insertValues = vi.fn();
    const onConflictFn = vi.fn().mockResolvedValue(undefined);

    insertValues.mockReturnValue({ onConflictDoUpdate: onConflictFn });

    const db = createMockDb({
      selectRows: [{ maxOrder: 3 }],
      insertValues,
    });

    mockGetDb.mockReturnValue(db);

    await upsertAssignment('guest-1', 'table-1', 'event-main');

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        guestId: 'guest-1',
        tableId: 'table-1',
        eventId: 'event-main',
        seatOrder: 4,
      }),
    );
    expect(onConflictFn).toHaveBeenCalledWith(
      expect.objectContaining({
        set: { tableId: 'table-1', seatOrder: 4 },
      }),
    );
  });

  test('should start seatOrder at 0 for an empty table', async () => {
    const insertValues = vi.fn();

    insertValues.mockReturnValue({
      onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
    });

    const db = createMockDb({
      selectRows: [{ maxOrder: null }],
      insertValues,
    });

    mockGetDb.mockReturnValue(db);

    await upsertAssignment('guest-1', 'table-1', 'event-main');

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ seatOrder: 0 }),
    );
  });
});

describe('deleteAssignmentForGuest', () => {
  test('should issue a delete for the guest assignment', async () => {
    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    const db = createMockDb({ deleteWhere });

    mockGetDb.mockReturnValue(db);

    await deleteAssignmentForGuest('guest-1', 'event-main');

    expect(db.delete).toHaveBeenCalled();
    expect(deleteWhere).toHaveBeenCalled();
  });
});
