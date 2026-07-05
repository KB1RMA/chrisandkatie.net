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
  findEventRsvpRowsForExport,
  findMealBreakdownForEvent,
} from './rsvpResponses';
import type { EventRsvpExportRow } from './rsvpResponses';

const mockGetDb = vi.mocked(getDb);

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

/**
 * Creates a mock Drizzle database whose select builder chain resolves to the
 * given rows. Every chain method returns the same chain object so any join /
 * where / ordering combination can be exercised; the terminal `orderBy` and
 * `groupBy` calls resolve with `rows`.
 *
 * @param rows - The rows the query chain should resolve with.
 * @returns The mock DbClient plus the chain spies for assertions.
 */
function createSelectChainDb(rows: unknown[]) {
  const chain = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn().mockResolvedValue(rows),
    groupBy: vi.fn().mockResolvedValue(rows),
  };

  chain.from.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  chain.leftJoin.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);

  const selectFn = vi.fn().mockReturnValue(chain);
  const db = { select: selectFn } as unknown as DbClient;

  return { db, selectFn, chain };
}

/** Creates a minimal EventRsvpExportRow fixture. */
function makeExportRow(
  overrides: Partial<EventRsvpExportRow> = {},
): EventRsvpExportRow {
  return {
    guestId: 'guest-uuid-1',
    guestFirstName: 'Jane',
    guestLastName: 'Doe',
    partyName: 'Doe Family',
    attendanceStatus: 'attending',
    numberOfAttending: 2,
    specialRequests: null,
    guestNotes: null,
    attendeeName: 'Jane Doe',
    attendeeMealOption: 'option_a',
    attendeeDietaryRestrictions: null,
    ...overrides,
  };
}

describe('findEventRsvpRowsForExport', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('should resolve with the flattened export rows', async () => {
    const rows = [makeExportRow(), makeExportRow({ guestId: 'guest-uuid-2' })];
    const { db } = createSelectChainDb(rows);

    mockGetDb.mockReturnValue(db);

    await expect(findEventRsvpRowsForExport('event-1')).resolves.toEqual(rows);
  });

  test('should join guests, invitations, responses, and attendees', async () => {
    const { db, selectFn, chain } = createSelectChainDb([]);

    mockGetDb.mockReturnValue(db);

    await findEventRsvpRowsForExport('event-1');

    expect(selectFn).toHaveBeenCalledOnce();
    expect(chain.from).toHaveBeenCalledOnce();
    expect(chain.innerJoin).toHaveBeenCalledOnce();
    expect(chain.leftJoin).toHaveBeenCalledTimes(3);
    expect(chain.where).toHaveBeenCalledOnce();
    expect(chain.orderBy).toHaveBeenCalledOnce();
  });

  test('should select all EventRsvpExportRow columns', async () => {
    const { db, selectFn } = createSelectChainDb([]);

    mockGetDb.mockReturnValue(db);

    await findEventRsvpRowsForExport('event-1');

    const selection = selectFn.mock.calls[0][0];

    expect(Object.keys(selection).sort()).toEqual(
      Object.keys(makeExportRow()).sort(),
    );
  });
});

describe('findMealBreakdownForEvent', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('should resolve with per-option counts as numbers', async () => {
    const { db } = createSelectChainDb([
      { mealOption: 'option_a', count: 4 },
      { mealOption: 'option_b', count: '2' },
    ]);

    mockGetDb.mockReturnValue(db);

    await expect(findMealBreakdownForEvent('event-1')).resolves.toEqual([
      { mealOption: 'option_a', count: 4 },
      { mealOption: 'option_b', count: 2 },
    ]);
  });

  test('should exclude attendees without a selected meal option', async () => {
    const { db } = createSelectChainDb([
      { mealOption: null, count: 3 },
      { mealOption: 'option_a', count: 1 },
    ]);

    mockGetDb.mockReturnValue(db);

    await expect(findMealBreakdownForEvent('event-1')).resolves.toEqual([
      { mealOption: 'option_a', count: 1 },
    ]);
  });

  test('should filter to attending responses and group by meal option', async () => {
    const { db, chain } = createSelectChainDb([]);

    mockGetDb.mockReturnValue(db);

    await findMealBreakdownForEvent('event-1');

    expect(chain.innerJoin).toHaveBeenCalledOnce();
    expect(chain.where).toHaveBeenCalledOnce();
    expect(chain.groupBy).toHaveBeenCalledOnce();
  });
});
