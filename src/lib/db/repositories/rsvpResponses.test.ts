/**
 * @vitest-environment node
 */

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));

import { expect, test, describe, beforeEach, vi } from 'vitest';
import { getDb } from '@/lib/db';
import type { DbClient } from '@/lib/db';
import { getRsvpSummaryForEvent } from './rsvpResponses';

const mockGetDb = vi.mocked(getDb);

/**
 * Mocks db.select().from().innerJoin().where() resolving to a single count row,
 * for three sequential calls (total, attending, notAttending) via Promise.all.
 */
function createMockDb(counts: [number, number, number]): DbClient {
  const selectFn = vi.fn();

  counts.forEach((c) => {
    const whereFn = vi.fn().mockResolvedValue([{ count: c }]);
    const innerJoinFn = vi.fn().mockReturnValue({ where: whereFn });
    const fromFn = vi.fn().mockReturnValue({ innerJoin: innerJoinFn });
    selectFn.mockReturnValueOnce({ from: fromFn });
  });

  return { select: selectFn } as unknown as DbClient;
}

describe('getRsvpSummaryForEvent', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('should count distinct invitations, not individual guest rows', async () => {
    // A 3-person invitation where only the primary guest has responded:
    // 1 invitation total, 1 attending, 0 not attending → 0 no-response.
    mockGetDb.mockReturnValue(createMockDb([1, 1, 0]));

    const result = await getRsvpSummaryForEvent('event-1');

    expect(result).toEqual({
      total: 1,
      attending: 1,
      notAttending: 0,
      noResponse: 0,
    });
  });

  test('should derive noResponse as total minus attending minus notAttending', async () => {
    mockGetDb.mockReturnValue(createMockDb([5, 2, 1]));

    const result = await getRsvpSummaryForEvent('event-1');

    expect(result).toEqual({
      total: 5,
      attending: 2,
      notAttending: 1,
      noResponse: 2,
    });
  });

  test('should issue three select queries joined through guests', async () => {
    const mockDb = createMockDb([3, 1, 1]);
    mockGetDb.mockReturnValue(mockDb);

    await getRsvpSummaryForEvent('event-1');

    expect(mockDb.select).toHaveBeenCalledTimes(3);
  });

  test('should return all zeros when no invitations are associated with the event', async () => {
    mockGetDb.mockReturnValue(createMockDb([0, 0, 0]));

    const result = await getRsvpSummaryForEvent('event-1');

    expect(result).toEqual({
      total: 0,
      attending: 0,
      notAttending: 0,
      noResponse: 0,
    });
  });
});
