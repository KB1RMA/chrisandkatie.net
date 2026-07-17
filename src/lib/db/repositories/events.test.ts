/**
 * @vitest-environment node
 */

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getDb } from '@/lib/db';
import type { DbClient } from '@/lib/db';
import { eventExistsById } from './events';

const mockGetDb = vi.mocked(getDb);

/**
 * Builds a mock Drizzle client whose select chain resolves to the given rows.
 */
function makeDb(rows: Array<{ id: string }>) {
  const limit = vi.fn(async () => rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  return { db: { select } as unknown as DbClient, select, limit };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('eventExistsById', () => {
  test('should return true when an event row exists', async () => {
    const { db } = makeDb([{ id: 'event-1' }]);

    await expect(eventExistsById('event-1', db)).resolves.toBe(true);
  });

  test('should return false when no event row exists', async () => {
    const { db } = makeDb([]);

    await expect(eventExistsById('missing', db)).resolves.toBe(false);
  });

  test('should limit the lookup to a single row', async () => {
    const { db, limit } = makeDb([{ id: 'event-1' }]);

    await eventExistsById('event-1', db);

    expect(limit).toHaveBeenCalledWith(1);
  });

  test('should default to the request-scoped client from getDb', async () => {
    const { db, select } = makeDb([{ id: 'event-1' }]);

    mockGetDb.mockReturnValue(db);

    await expect(eventExistsById('event-1')).resolves.toBe(true);
    expect(mockGetDb).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalled();
  });
});
